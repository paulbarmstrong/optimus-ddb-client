import { DynamoDBClient, DynamoDBClientConfig, TransactionCanceledException } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, BatchGetCommand, TransactWriteCommand, ScanCommand, QueryCommand, QueryCommandInput,
	ScanCommandInput,  QueryCommandOutput, ScanCommandOutput} from "@aws-sdk/lib-dynamodb"
import { ShapeToType, validateDataShape } from "shape-tape"
import { AnyToNever, FilterCondition, InvalidNextTokenError, ItemNotFoundError, ItemShapeValidationError, ItemWithoutVersionError, OptimisticLockError,
	PartitionKeyCondition, ShapeObject, ShapeObjectToType } from "../Types"
import { decodeNextToken, encodeNextToken, getDynamoDbExpression, getIndexTable, getLastEvaluatedKeyShape, shallowEquals } from "../Utilities"
import { ExpressionBuilder } from "./ExpressionBuilder"
import { Table } from "./Table"
import { Gsi } from "./Gsi"
import { SortKeyCondition, UnprocessedKeysError } from "../Types"
import { ItemsPagesIterator } from "./ItemsPagesIterator"

type ItemData = {
	table: Table<any, any, any>,
	existingKey: Record<string, any>,
	version: number,
	delete: boolean,
	create: boolean
}

/**
 * Class to be used as a high level DynamoDB client. Consumers call various functions on their 
 * OptimusDdbClient to perform operations on items in their tables. Please see the README for more
 * high level information.
 * 
 * The overhead associated with an instance of OptimusDdbClient is similar to that of
 * DynamoDBDocumentClient from the AWS SDK (that's because OptimusDdbClient creates a 
 * DynamoDBDocumentClient).
 * 
 * Most failure modes correspond to DynamoDBDocumentClient errors and in those cases OptimusDdbClient
 * lets such errors propagate out to the caller. OptimusDdbClient also has some of its own errors types
 * and those are mentioned on each function documentation.
 */
export class OptimusDdbClient {
	/** @hidden */
	#recordedItems: WeakMap<Record<string, any>, ItemData>
	/** @hidden */
	#ddbDocumentClient: DynamoDBDocumentClient
	constructor(params?: {
		/** Any DynamoDBClientConfig options for OptimusDdbClient to consider. */
		dynamoDbClientConfig?: DynamoDBClientConfig
	}) {
		this.#recordedItems = new WeakMap<Record<string, any>, ItemData>()
		this.#ddbDocumentClient = DynamoDBDocumentClient.from(new DynamoDBClient({...params?.dynamoDbClientConfig}), {
			marshallOptions: {
				removeUndefinedValues: true
			}
		})
	}

	/**
	 * Drafts an item for creation. It does not call DynamoDB. The item is only
	 * created in DynamoDB once it is included in the `items` of a call to `commitItems`.
	 * 
	 * @returns The drafted item.
	 * @throws ItemShapeValidationError if the item does not match the Table's `itemShape`.
	 */
	draftItem<I extends ShapeObject, P extends keyof I, S extends keyof I>(params: {
		/** Table where the item should go. */
		table: Table<I,P,S>,
		/** Object representing the item to be drafted. It should be an object not provided to OptimusDdbClient before. */
		item: ShapeObjectToType<I>
	}): ShapeObjectToType<I> {
		return this.#recordAndStripItem({ ...params.item }, params.table, true)
	}

	/**
	 * Marks an item for deletion. It does not call DynamoDB. The item is only
	 * deleted in DynamoDB once it is included in the `items` of a call to `commitItems`
	 */
	markItemForDeletion(params: {
		/** Item to be marked for deletion. It needs to be an item produced by OptimusDdbClient. */
		item: Record<string, any>
	}) {
		if (!this.#recordedItems.has(params.item)) throw new Error(`Unrecorded item cannot be marked for deletion: ${JSON.stringify(params.item)}`)
		if (this.#recordedItems.get(params.item)!.delete) throw new Error(`Item is already marked for deletion: ${JSON.stringify(params.item)}`)
		this.#recordedItems.get(params.item)!.delete = true
	}

	/**
	 * Gets an item from the given Table with the given key. It calls [the GetItem DynamoDB API](
	 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html).
	 * 
	 * @returns The item with the given key (or `undefined` if the item is not found and 
	 * `itemNotFoundErrorOverride` is set to a function that returns `undefined`).
	 * @throws ItemNotFoundError if the item is not found (and `itemNotFoundErrorOverride` is not set).
	 * @throws ItemShapeValidationError if the item does not match the Table's `itemShape`.
	 */
	async getItem<I extends ShapeObject, P extends keyof I, S extends keyof I, E extends Error | undefined = Error>(params: {
		/** Table to look in. */
		table: Table<I,P,S>,
		/** Key to look up. */
		key: { [T in P]: ShapeToType<I[P]> } & { [T in S]: ShapeToType<I[S]> }
		/**
		 * Optional parameter to override `ItemNotFoundError`. If it returns `Error`
		 * then `getItem` will throw that error instead of `ItemNotFoundError`. If it 
		 * returns `undefined` then `getItem` will return `undefined` instead of throwing `ItemNotFoundError`.
		 */
		itemNotFoundErrorOverride?: (e: ItemNotFoundError) => E
	}): Promise<E extends Error ? ShapeObjectToType<I> : ShapeObjectToType<I> | undefined> {
		const item = (await this.#ddbDocumentClient.send(new GetCommand({
			TableName: params.table.tableName,
			Key: params.key,
			ConsistentRead: true
		}))).Item
		if (item === undefined) {
			const error = params.itemNotFoundErrorOverride !== undefined ? (
				params.itemNotFoundErrorOverride(new ItemNotFoundError({ itemKeys: [params.key] }))
			) : (
				new ItemNotFoundError({ itemKeys: [params.key] })
			)
			if (error instanceof Error) {
				throw error
			} else {
				return undefined as E extends Error ? ShapeObjectToType<I> : ShapeObjectToType<I> | undefined
			}
		} else {
			return this.#recordAndStripItem(item, params.table, false) as ShapeObjectToType<I>
		}
	}

	/**
	 * Gets items from the given Table with the given keys. It calls [the BatchGetItem DynamoDB API](
	 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html).
	 * 
	 * @returns All of the items with the given keys (or just the items that were found if 
	 * `itemNotFoundErrorOverride` is set to a function that returns `undefined`).
	 * @throws UnprocessedKeysError when OptimusDdbClient is unable to get DynamoDB to process one or more
	 * keys while it is calling BatchGetItem.
	 * @throws ItemNotFoundError if one or more items are not found (and `itemNotFoundErrorOverride` is not set).
	 * @throws ItemShapeValidationError if an item does not match the Table's `itemShape`.
	 */
	async getItems<I extends ShapeObject, P extends keyof I, S extends keyof I>(params: {
		/** Table to look in. */
		table: Table<I,P,S>,
		/** Keys to look up. */
		keys: Array<{ [T in P]: ShapeToType<I[P]> } & { [T in S]: ShapeToType<I[S]> }>,
		/**
		 * Optional parameter to override `ItemNotFoundError`. If it returns `Error` then `getItems` will throw 
		 * that error instead of `ItemNotFoundError`. If it returns `undefined` then `getItems` will omit the item
		 * from its response instead of throwing `ItemNotFoundError`.
		 */
		itemNotFoundErrorOverride?: (e: ItemNotFoundError) => Error | undefined
	}): Promise<Array<ShapeObjectToType<I>>> {
		if (params.keys.length === 0) return []
		const unfinishedKeys: Array<Record<string,any>> = [...params.keys]
		const finishedItems: Array<Record<string,any>> = []
		while (unfinishedKeys.length > 0) {
			const currentAttemptedKeys = unfinishedKeys.splice(0, 100)
			const res = await this.#ddbDocumentClient.send(new BatchGetCommand({
				RequestItems: {
					[params.table.tableName]: {
						Keys: currentAttemptedKeys,
						ConsistentRead: true
					}
				}
			}))
			const unproccessedKeys = res.UnprocessedKeys !== undefined ? Object.values(res.UnprocessedKeys).map(x => x.Keys!) : []
			if (unproccessedKeys.length === currentAttemptedKeys.length) throw new UnprocessedKeysError({ unprocessedKeys: unproccessedKeys })
			finishedItems.push(...res.Responses![params.table.tableName])
			unfinishedKeys.push(...unproccessedKeys)
		}
		if (finishedItems.length !== params.keys.length) {
			const unfoundItemKeys = params.keys.filter(key => !finishedItems.find(item => {
				return Object.entries(key).filter(keyAttr => item[keyAttr[0]] !== keyAttr[1]).length === 0
			}))
			const error = params.itemNotFoundErrorOverride !== undefined ? (
				params.itemNotFoundErrorOverride(new ItemNotFoundError({ itemKeys: unfoundItemKeys }))
			) : (
				new ItemNotFoundError({ itemKeys: unfoundItemKeys })
			)
			if (error instanceof Error) {
				throw error
			}
		}
		const finishedItemsMap = new Map(finishedItems.map(item => [
			params.keys.find(key => params.table.keyAttributes.filter(keyAttr => (key as any)[keyAttr] !== item[keyAttr]).length === 0)!,
			item
		]))
		return Array.from(params.keys.map(key => finishedItemsMap.get(key)))
			.filter(item => item !== undefined)
			.map(item => this.#recordAndStripItem(item, params.table, false))
	}
	
	/**
	 * Querys items on the given Table or Gsi with the given conditions. It calls [the Query DynamoDB API](
	 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html). It may also call [
	 * the BatchGetItem DynamoDB API](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html)
	 * when it queries items from GSIs that don't project the attributes defined by the Table's itemShape.
	 * 
	 * @returns A tuple:
	 * * [0] All of the items that could be queried with the conditions up to the `limit` (if set).
	 * * [1] Either a nextToken if there's more to query after reaching the `limit`, or undefined. It's always
	 * undefined if `limit` is not set.
	 * @throws InvalidNextTokenError if the nextToken parameter is invalid.
	 * @throws UnprocessedKeysError when OptimusDdbClient is unable to get DynamoDB to process one or more
	 * keys while it is calling BatchGetItem (only relevant for GSIs that don't project the attributes defined
	 * by the Table's itemShape).
	 * @throws ItemShapeValidationError if an item does not match the Table's `itemShape`.
	 */
	async queryItems<I extends ShapeObject, P extends keyof I, S extends keyof I, L extends number | undefined = undefined>(params: {
		/** The table or GSI to query. */
		index: Table<I,P,S> | Gsi<I,P,S>,
		/** Condition to specify which partition the Query will take place in. */
		partitionKeyCondition: PartitionKeyCondition<P, ShapeToType<I[P]>>
		/** Optional condition to specify how the partition will be queried. */
		sortKeyCondition?: AnyToNever<ShapeToType<I[S]>> extends never ? never : SortKeyCondition<S, ShapeToType<I[S]>>,
		/** Optional list of conditions to filter down the results. */
		filterConditions?: Array<{
			[K in Exclude<Exclude<keyof I, P>, S>]: FilterCondition<K, ShapeToType<I[K]>>
		}[Exclude<Exclude<keyof I, P>, S>]>,
		/** Optional parameter used to switch the order of the query. */
		scanIndexForward?: boolean,
		/** Optional limit on the number of items to find before returning. */
		limit?: L,
		/** Optional parameter to continue based on a nextToken returned from an earlier `queryItems` call. */
		nextToken?: string,
		/** Optional parameter to override `InvalidNextTokenError`. */
		invalidNextTokenErrorOverride?: (e: InvalidNextTokenError) => Error
	}): Promise<[Array<ShapeObjectToType<I>>, L extends number ? string | undefined : undefined]> {
		const [items, nextToken] = await this.#handleQueryOrScan({
			index: params.index,
			commandInput: {
				TableName: getIndexTable(params.index).tableName,
				IndexName: params.index instanceof Gsi ? params.index.indexName : undefined,
				ConsistentRead: params.index instanceof Table,
				...getDynamoDbExpression({
					partitionKeyCondition: params.partitionKeyCondition,
					sortKeyCondition: params.sortKeyCondition,
					filterConditions: params.filterConditions !== undefined ? params.filterConditions : []
				}),
				ScanIndexForward: params.scanIndexForward
			},
			get: input => this.#ddbDocumentClient.send(new QueryCommand(input)),
			limit: params.limit,
			nextToken: params.nextToken,
			invalidNextTokenErrorOverride: params.invalidNextTokenErrorOverride
		})
		return [items, nextToken as L extends number ? string | undefined : undefined]
	}
	
	/**
	 * Scans items on the given Table or Gsi with the given conditions. It calls [the Scan DynamoDB API](
	 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html). It may also call 
	 * [the BatchGetItem DynamoDB API](
	 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html) when it scans
	 * items from GSIs that don't project the attributes defined by the Table's itemShape.
	 * 
	 * @returns A tuple:
	 * * [0] All of the items that could be scanned with the conditions up to the `limit` (if set).
	 * * [1] Either a nextToken if there's more to scan after reaching the `limit`, or undefined. It's always
	 * undefined if `limit` is not set.
	 * @throws InvalidNextTokenError if the nextToken parameter is invalid.
	 * @throws UnprocessedKeysError when OptimusDdbClient is unable to get DynamoDB to process one or more
	 * keys while it is calling BatchGetItem (only relevant for GSIs that don't project the attributes defined
	 * by the Table's itemShape).
	 * @throws ItemShapeValidationError if an item does not match the Table's `itemShape`.
	 */
	async scanItems<I extends ShapeObject, P extends keyof I, S extends keyof I, L extends number | undefined = undefined>(params: {
		/** The table or GSI to scan. */
		index: Table<I,P,S> | Gsi<I,P,S>,
		/** Optional list of conditions to filter down the results. */
		filterConditions?: Array<{
			[K in keyof I]: FilterCondition<K, ShapeToType<I[K]>>
		}[keyof I]>,
		/** Optional limit on the number of items to find before returning. */
		limit?: L,
		/** Optional parameter to continue based on a nextToken returned from an earlier `scanItems` call. */
		nextToken?: string,
		/** Optional parameter to override `InvalidNextTokenError`. */
		invalidNextTokenErrorOverride?: (e: InvalidNextTokenError) => Error
	}): Promise<[Array<ShapeObjectToType<I>>, L extends number ? string | undefined : undefined]> {
		const [items, nextToken] = await this.#handleQueryOrScan({
			index: params.index,
			commandInput: {
				TableName: getIndexTable(params.index).tableName,
				IndexName: params.index instanceof Gsi ? params.index.indexName : undefined,
				ConsistentRead: params.index instanceof Table,
				...getDynamoDbExpression({
					filterConditions: params.filterConditions !== undefined ? params.filterConditions : []
				})
			},
			get: input => this.#ddbDocumentClient.send(new ScanCommand(input)),
			limit: params.limit,
			nextToken: params.nextToken,
			invalidNextTokenErrorOverride: params.invalidNextTokenErrorOverride
		})
		return [items, nextToken as L extends number ? string | undefined : undefined]
	}
	
	/**
	 * Commits items together in a transaction. It calls [the TransactWriteItems DynamoDB API](
	 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html).
	 * 
	 * @throws ItemShapeValidationError if an item does not match the Table's `itemShape`.
	 * @throws OptimisticLockError if the transaction is cancelled due to a conditional check failure.
	 */
	async commitItems(params: {
		/** Items to be committed together. They need to be items produced by OptimusDdbClient. The limit is
		 * 100 (except that items having a key change count as 2). */
		items: Array<Record<string, any>>,
		/** Optional parameter to override `OptimisticLockError`. */
		optimisticLockErrorOverride?: (e: OptimisticLockError) => Error
	}) {
		if (params.items.length === 0) return
		const transactItems = params.items.map(item => {
			if (!this.#recordedItems.has(item)) throw new Error(`Unrecorded item cannot be committed: ${JSON.stringify(item)}`)
			const itemData = this.#recordedItems.get(item)!
			validateDataShape({
				data: item,
				shape: itemData.table.itemShape,
				shapeValidationErrorOverride: e => new ItemShapeValidationError(e)
			})
			const keyChanged: boolean = itemData.table.keyAttributes
				.filter(keyAttr => itemData.existingKey[keyAttr] !== item[keyAttr]).length > 0
			if (itemData.delete) {
				return [{
					Delete: {
						TableName: itemData.table.tableName,
						Key: itemData.existingKey,
						...getDynamoDbExpression({
							conditionConditions: [
								[itemData.table.versionAttribute, "=", itemData.version]
							]
						})
					}
				}]
			} else if (itemData.create) {
				return [{
					Put: {
						TableName: itemData.table.tableName,
						Item: { ...item, [itemData.table.versionAttribute]: itemData.version },
						...getDynamoDbExpression({
							conditionConditions: [[itemData.table.partitionKey, "doesn't exist"]]
						})
					}
				}]
			} else if (keyChanged) {
				return [
					{
						Put: {
							TableName: itemData.table.tableName,
							Item: { ...item, [itemData.table.versionAttribute]: itemData.version+1 },
							...getDynamoDbExpression({
								conditionConditions: [[itemData.table.partitionKey, "doesn't exist"]]
							})
						}
					}, {
						Delete: {
							TableName: itemData.table.tableName,
							Key: itemData.existingKey,
							...getDynamoDbExpression({
								conditionConditions: [
									[itemData.table.versionAttribute, "=", itemData.version]
								]
							})
						}
					}
				]
			} else {
				return [{
					Update: {
						TableName: itemData.table.tableName,
						Key: itemData.existingKey,
						...this.#getUpdateDynamoDbExpression(item, itemData)
					}
				}]
			}
		}).flat()
		try {
			await this.#ddbDocumentClient.send(new TransactWriteCommand({
				TransactItems: transactItems
			}))
		} catch (error) {
			if ((error as Error).name === "TransactionCanceledException") {
				const exception = error as TransactionCanceledException
				if (exception.CancellationReasons !== undefined && exception.CancellationReasons
					.filter(reason => reason.Code === "ConditionalCheckFailed").length > 0) {
					throw params.optimisticLockErrorOverride !== undefined ? (
						params.optimisticLockErrorOverride(new OptimisticLockError())
					) : (
						new OptimisticLockError()
					)
				} else {
					throw error
				}
			} else {
				throw error
			}
		}
		params.items.forEach(item => {
			const itemData = this.#recordedItems.get(item)!
			if (itemData.create) {
				itemData.create = false
			} else {
				itemData.version = itemData.version + 1
			}
			itemData.existingKey = Object.fromEntries(itemData.table.keyAttributes.map(keyAttr => [keyAttr, item[keyAttr]]))
			if (itemData.delete) this.#recordedItems.delete(item)
		})
	}

	/**
	 * Gets an item's optimistic locking version number.
	 * 
	 * @returns The item's optimistic locking version number.
	 */
	getItemVersion(params: {
		/** An item produced by DynamoDbClient */
		item: Record<string, any>
	}): number {
		const itemData = this.#recordedItems.get(params.item)
		if (itemData === undefined)
			throw new Error(`Cannot get version for unrecorded item: ${JSON.stringify(params.item)}`)
		return itemData.version
	}
	
	/** @hidden */
	#recordAndStripItem<I extends ShapeObject, P extends keyof I, S extends keyof I>
			(item: any, table: Table<I,P,S>, create: boolean): ShapeToType<typeof table.itemShape> {
		if (!create && !Number.isInteger(item[table.versionAttribute]))
			throw new ItemWithoutVersionError(`Found ${table.tableName} item without version attribute "${table.versionAttribute}": ${JSON.stringify(item)}`)
		const version = create ? 0 : item[table.versionAttribute]
		delete item[table.versionAttribute]
		const validatedItem: ShapeToType<typeof table.itemShape> = validateDataShape({
			data: item,
			shape: table.itemShape,
			shapeValidationErrorOverride: e => new ItemShapeValidationError(e)
		})
		this.#recordedItems.set(item, {
			table: table,
			existingKey: Object.fromEntries(table.keyAttributes.map(keyAttr => [keyAttr, item[keyAttr]])),
			version: version,
			delete: false,
			create: create
		})
		return validatedItem
	}

	/** @hidden */
	#getUpdateDynamoDbExpression<I extends ShapeObject>
			(item: ShapeObjectToType<I>, itemData: ItemData) {
		const builder: ExpressionBuilder = new ExpressionBuilder()
		const set = itemData.table.attributes
			.filter(key => item[key as string] !== undefined && !itemData.table.keyAttributes.includes(key as string))
			.map(key => `${builder.addName(key as string)} = ${builder.addValue(item[key as string])}`)
			.concat(`${builder.addName(itemData.table.versionAttribute)} = ${builder.addValue(itemData.version+1)}`)
			.join(", ")
		const remove = itemData.table.attributes
			.filter(key => item[key as string] === undefined && !itemData.table.keyAttributes.includes(key as string))
			.map(key => builder.addName(key as string))
			.join(", ")
		return {
			UpdateExpression: remove.length > 0 ? `SET ${set} REMOVE ${remove}` : `SET ${set}`,
			ConditionExpression: `(${builder.addName(itemData.table.versionAttribute)} = ${builder.addValue(itemData.version)})`,
			ExpressionAttributeNames: builder.attributeNames,
			ExpressionAttributeValues: builder.attributeValues
		}
	}

	/** @hidden */
	async #handleQueryOrScan<I extends ShapeObject, P extends keyof I, S extends keyof I>(params: {
		index: Table<I,P,S> | Gsi<I,P,S>
        commandInput: QueryCommandInput | ScanCommandInput,
        get: (input: QueryCommandInput | ScanCommandInput) => Promise<QueryCommandOutput | ScanCommandOutput>,
		limit: number | undefined,
        nextToken: string | undefined,
		invalidNextTokenErrorOverride: ((e: InvalidNextTokenError) => Error) | undefined
	}): Promise<[Array<ShapeObjectToType<I>>, string | undefined]> {
		const table = getIndexTable(params.index)
		const itemsPagesIterator = new ItemsPagesIterator({
			commandInput: params.commandInput,
			get: params.get,
			limit: params.limit,
			lastEvaluatedKey: decodeNextToken(params.nextToken, getLastEvaluatedKeyShape(params.index), params.invalidNextTokenErrorOverride)
		})
		const items: Array<ShapeObjectToType<I>> = []
		while (itemsPagesIterator.hasNext()) {
			const page = await itemsPagesIterator.next()
			const incompleteItems: Array<Record<string,any>> = []
			page.forEach(item => {
				try {
					items.push(this.#recordAndStripItem(item, table, false))
				} catch (error) {
					if (params.index instanceof Gsi && 
						(error instanceof ItemWithoutVersionError || (error instanceof ItemShapeValidationError && error.data === undefined))) {
						incompleteItems.push(item)
					} else {
						throw error
					}
				}
			})
			const incompleteItemKeys: any = incompleteItems.map(item => Object.fromEntries(Object.entries(item).filter(attr => table.keyAttributes.includes(attr[0]))))
			items.push(...(await this.getItems({ table: table, keys: incompleteItemKeys, itemNotFoundErrorOverride: () => undefined })))
		}
		return [
			items,
			encodeNextToken(itemsPagesIterator.lastEvaluatedKey)
		]
	}
}
