import { DynamoDBClient, DynamoDBClientConfig, TransactionCanceledException } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, BatchGetCommand, TransactWriteCommand, ScanCommand, QueryCommand, QueryCommandInput,
	ScanCommandInput,  QueryCommandOutput, ScanCommandOutput} from "@aws-sdk/lib-dynamodb"
import * as z from "zod"
import { AnyToNever, FilterCondition, InvalidResumeKeyError, ItemNotFoundError, ItemValidationError, ItemWithoutVersionError, 
	OptimisticLockError, PartitionKeyCondition, MergeUnion, 
	NonStripZodObject} from "../Types"
import { decodeResumeKey, encodeResumeKey, getDynamoDbExpression, getIndexTable, getLastEvaluatedKeySchema,
	getUpdateDynamoDbExpression, isGsi, itemKeyEq, optimusCommitItemsToPerKeyItemChanges, validateRelationshipsOnCommit, 
	zodValidate } from "../Utilities"
import { Table } from "./Table"
import { Gsi } from "./Gsi"
import { SortKeyCondition, UnprocessedKeysError } from "../Types"
import { ItemsPagesIterator } from "./ItemsPagesIterator"

export type ItemData = {
	table: Table<any, any, any>,
	existingItem: Record<string, any>,
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
 * lets the error propagate out to the caller. OptimusDdbClient also has some of its own errors types
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
	 * @throws ItemValidationError if the item does not match the Table's `itemSchema`.
	 */
	draftItem<I extends NonStripZodObject| z.ZodUnion<[NonStripZodObject, ...NonStripZodObject[]]>, P extends keyof z.infer<I>, S extends keyof z.infer<I>, 
			T extends z.infer<I>>(params: {
		/** Table where the item should go. */
		table: Table<I,P,S>,
		/** Object representing the item to be drafted. It should be an object not provided to OptimusDdbClient before. */
		item: T
	}): T {
		return this.#recordAndStripItem<I, P, S>({ ...params.item }, params.table, true) as T
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
	 * @throws ItemValidationError if the item does not match the Table's `itemSchema`.
	 */
	async getItem<I extends NonStripZodObject| z.ZodUnion<[NonStripZodObject, ...NonStripZodObject[]]>, P extends keyof z.infer<I>,
			S extends keyof z.infer<I>, E extends Error | undefined = Error>(params: {
		/** Table to look in. */
		table: Table<I,P,S>,
		/** Key to look up. */
		key: { [T in P]: z.infer<I>[P] } & { [T in S]: z.infer<I>[S] }
		/**
		 * Optional parameter to override `ItemNotFoundError`. If it returns `Error`
		 * then `getItem` will throw that error instead of `ItemNotFoundError`. If it 
		 * returns `undefined` then `getItem` will return `undefined` instead of throwing `ItemNotFoundError`.
		 */
		itemNotFoundErrorOverride?: (e: ItemNotFoundError) => E
	}): Promise<E extends Error ? z.infer<I> : z.infer<I> | undefined> {
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
				return undefined as E extends Error ? z.infer<I> : z.infer<I> | undefined
			}
		} else {
			return this.#recordAndStripItem(item, params.table, false) as z.infer<I>
		}
	}

	/**
	 * Gets items from the given Table with the given keys. It calls [the BatchGetItem DynamoDB API](
	 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html) as many times as
	 * necessary to get all the requested items.
	 * 
	 * @returns All of the items with the given keys (or just the items that were found if 
	 * `itemNotFoundErrorOverride` is set to a function that returns `undefined`).
	 * @throws UnprocessedKeysError when OptimusDdbClient is unable to get DynamoDB to process one or more
	 * keys while it is calling BatchGetItem.
	 * @throws ItemNotFoundError if one or more items are not found (and `itemNotFoundErrorOverride` is not set).
	 * @throws ItemValidationError if an item does not match the Table's `itemSchema`.
	 */
	async getItems<I extends NonStripZodObject| z.ZodUnion<[NonStripZodObject, ...NonStripZodObject[]]>, P extends keyof z.infer<I>,
			S extends keyof z.infer<I>>(params: {
		/** Table to look in. */
		table: Table<I,P,S>,
		/** Keys to look up. */
		keys: Array<{ [T in P]: z.infer<I>[P] } & { [T in S]: z.infer<I>[S] }>,
		/**
		 * Optional parameter to override `ItemNotFoundError`. If it returns `Error` then `getItems` will throw 
		 * that error instead of `ItemNotFoundError`. If it returns `undefined` then `getItems` will omit the item
		 * from its response instead of throwing `ItemNotFoundError`.
		 */
		itemNotFoundErrorOverride?: (e: ItemNotFoundError) => Error | undefined
	}): Promise<Array<z.infer<I>>> {
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
			const unfoundItemKeys = params.keys
				.filter(key => !finishedItems.find(item => itemKeyEq(params.table, key, item)))
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
			params.keys.find(key => itemKeyEq(params.table, key, item))!,
			item
		]))
		return Array.from(params.keys.map(key => finishedItemsMap.get(key)))
			.filter(item => item !== undefined)
			.map(item => this.#recordAndStripItem(item, params.table, false))
	}
	
	/**
	 * Querys items on the given Table or Gsi with the given conditions. It calls [the Query DynamoDB API](
	 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html) as many times as necessary to hit the 
	 * specified limit or hit the end of the index. It may also call [the BatchGetItem DynamoDB API](
	 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html) when it queries items from GSIs 
	 * that don't project the attributes defined by the Table's itemSchema.
	 * 
	 * @returns A tuple:
	 * * [0] All of the items that could be queried with the conditions up to the `limit` (if set).
	 * * [1] Either a `resumeKey` if there's more to query after reaching the `limit`, or undefined. It's always
	 * undefined if `limit` is not set. **WARNING: The `resumeKey` is the LastEvaluatedKey returned by DynamoDB. It contains key 
	 * attribute names and values from the DynamoDB table.**
	 * @throws InvalidResumeKeyError if the `resumeKey` parameter is invalid.
	 * @throws UnprocessedKeysError when OptimusDdbClient is unable to get DynamoDB to process one or more
	 * keys while it is calling BatchGetItem (only relevant for GSIs that don't project the attributes defined
	 * by the Table's itemSchema).
	 * @throws ItemValidationError if an item does not match the Table's `itemSchema`.
	 */
	async queryItems<I extends NonStripZodObject| z.ZodUnion<[NonStripZodObject, ...NonStripZodObject[]]>, P extends keyof MergeUnion<z.infer<I>>, 
			S extends keyof MergeUnion<z.infer<I>>, L extends number | undefined = undefined>(params: {
		/** The table or GSI to query. */
		index: Table<I,P,S> | Gsi<I,P,S>,
		/** Condition to specify which partition the Query will take place in. */
		partitionKeyCondition: PartitionKeyCondition<P, z.infer<I>[P]>
		/** Optional condition to specify how the partition will be queried. */
		sortKeyCondition?: AnyToNever<MergeUnion<z.infer<I>>[S]> extends never ? never : SortKeyCondition<S, MergeUnion<z.infer<I>>[S]>,
		/** Optional condition to filter items during the query. */
		filterCondition?: FilterCondition<Omit<Omit<MergeUnion<z.infer<I>>, P>, S>>,
		/** Optional parameter used to switch the order of the query. */
		scanIndexForward?: boolean,
		/** Optional parameter to continue based on a `resumeKey` returned from an earlier `queryItems` call. */
		resumeKey?: string,
		/** Optional limit on the number of items to find before returning. */
		limit?: L,
		/** Optional parameter to override `InvalidResumeKeyError`. */
		invalidResumeKeyErrorOverride?: (e: InvalidResumeKeyError) => Error
	}): Promise<[Array<z.infer<I>>, L extends number ? string | undefined : undefined]> {
		const [items, resumeKey] = await this.#handleQueryOrScan({
			index: params.index,
			commandInput: {
				TableName: getIndexTable(params.index).tableName,
				IndexName: isGsi(params.index) ? (params.index as Gsi<I,P,S>).indexName : undefined,
				ConsistentRead: !isGsi(params.index),
				...getDynamoDbExpression({
					partitionKeyCondition: params.partitionKeyCondition,
					sortKeyCondition: params.sortKeyCondition,
					filterCondition: params.filterCondition as FilterCondition<any> | undefined
				}),
				ScanIndexForward: params.scanIndexForward
			},
			get: input => this.#ddbDocumentClient.send(new QueryCommand(input)),
			resumeKey: params.resumeKey,
			limit: params.limit,
			invalidResumeKeyErrorOverride: params.invalidResumeKeyErrorOverride
		})
		return [items, resumeKey as L extends number ? string | undefined : undefined]
	}
	
	/**
	 * Scans items on the given Table or Gsi with the given conditions. It calls [the Scan DynamoDB API](
	 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html) as many times as necessary to hit the 
	 * specified limit or hit the end of the index. It may also call [the BatchGetItem DynamoDB API](
	 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html) when it scans items from GSIs
	 * that don't project the attributes defined by the Table's itemSchema.
	 * 
	 * @returns A tuple:
	 * * [0] All of the items that could be scanned with the conditions up to the `limit` (if set).
	 * * [1] Either a `resumeKey` if there's more to scan after reaching the `limit`, or undefined. It's always
	 * undefined if `limit` is not set. **WARNING: The `resumeKey` is the LastEvaluatedKey returned by DynamoDB. It contains key 
	 * attribute names and values from the DynamoDB table.**
	 * @throws InvalidResumeKeyError if the `resumeKey` parameter is invalid.
	 * @throws UnprocessedKeysError when OptimusDdbClient is unable to get DynamoDB to process one or more
	 * keys while it is calling BatchGetItem (only relevant for GSIs that don't project the attributes defined
	 * by the Table's itemSchema).
	 * @throws ItemValidationError if an item does not match the Table's `itemSchema`.
	 */
	async scanItems<I extends NonStripZodObject | z.ZodUnion<[NonStripZodObject, ...NonStripZodObject[]]>, P extends keyof MergeUnion<z.infer<I>>, 
			S extends keyof MergeUnion<z.infer<I>>, L extends number | undefined = undefined>(params: {
		/** The table or GSI to scan. */
		index: Table<I,P,S> | Gsi<I,P,S>,
		/** Optional condition to filter items during the scan. */
		filterCondition?: FilterCondition<MergeUnion<z.infer<I>>>,
		/** Optional parameter to continue based on a `resumeKey` returned from an earlier `scanItems` call. */
		resumeKey?: string,
		/** Optional limit on the number of items to find before returning. */
		limit?: L,
		/** Optional parameter to override `InvalidResumeKeyError`. */
		invalidResumeKeyErrorOverride?: (e: InvalidResumeKeyError) => Error
	}): Promise<[Array<z.infer<I>>, L extends number ? string | undefined : undefined]> {
		const [items, resumeKey] = await this.#handleQueryOrScan({
			index: params.index,
			commandInput: {
				TableName: getIndexTable(params.index).tableName,
				IndexName: isGsi(params.index) ? (params.index as Gsi<I,P,S>).indexName : undefined,
				ConsistentRead: !isGsi(params.index),
				...getDynamoDbExpression({
					filterCondition: params.filterCondition as FilterCondition<any> | undefined
				})
			},
			get: input => this.#ddbDocumentClient.send(new ScanCommand(input)),
			resumeKey: params.resumeKey,
			limit: params.limit,
			invalidResumeKeyErrorOverride: params.invalidResumeKeyErrorOverride
		})
		return [items, resumeKey as L extends number ? string | undefined : undefined]
	}
	
	/**
	 * Commits items together in a transaction. It calls [the TransactWriteItems DynamoDB API](
	 * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html).
	 * 
	 * @throws ItemValidationError if an item does not match the Table's `itemSchema`.
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
		params.items.forEach(item => {
			if (!this.#recordedItems.has(item)) throw new Error(`Unrecorded item cannot be committed: ${JSON.stringify(item)}`)
			zodValidate(this.#recordedItems.get(item)!.table.itemSchema, item, e => new ItemValidationError(e))
		})
		const perKeyItemChanges = optimusCommitItemsToPerKeyItemChanges(this.#recordedItems, params.items)
		validateRelationshipsOnCommit(perKeyItemChanges)
		const transactItems = perKeyItemChanges.map(itemChange => {
			if (itemChange.oldItem !== undefined && itemChange.newItem !== undefined) {
				return [{
					Update: {
						TableName: itemChange.table.tableName,
						Key: itemChange.key,
						...(getUpdateDynamoDbExpression(itemChange.table, itemChange.newItem, itemChange.existingDdbItemVersion!))
					}
				}]
			} else if (itemChange.oldItem === undefined && itemChange.newItem !== undefined) {
				return [{
					Put: {
						TableName: itemChange.table.tableName,
						Item: { ...itemChange.newItem, [itemChange.table.versionAttributeName]: 0 },
						...getDynamoDbExpression({
							conditionConditions: itemChange.table.sortKey !== undefined ? (
								[
									[itemChange.table.partitionKey, "doesn't exist"],
									[itemChange.table.sortKey, "doesn't exist"]
								]
							) : (
								[[itemChange.table.partitionKey, "doesn't exist"]]
							)
						})
					}
				}]
			} else if (itemChange.oldItem !== undefined && itemChange.newItem === undefined) {
				return [{
					Delete: {
						TableName: itemChange.table.tableName,
						Key: itemChange.key,
						...getDynamoDbExpression({
							conditionConditions: [
								[itemChange.table.versionAttributeName, "=", itemChange.existingDdbItemVersion!]
							]
						})
					}
				}]
			} else {
				return []
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
			const keyChanged: boolean = !itemKeyEq(itemData.table, item, itemData.existingItem)
			if (itemData.create) {
				itemData.create = false
			} else {
				itemData.version = keyChanged ? 0 : itemData.version + 1
			}
			itemData.existingItem = structuredClone(item)
			if (itemData.delete) this.#recordedItems.delete(item)
		})
	}

	/**
	 * Gets an item's optimistic locking version number.
	 * 
	 * @returns The item's optimistic locking version number.
	 */
	getItemVersion(params: {
		/** An item produced by OptimusDdbClient */
		item: Record<string, any>
	}): number {
		const itemData = this.#recordedItems.get(params.item)
		if (itemData === undefined)
			throw new Error(`Cannot get version for unrecorded item: ${JSON.stringify(params.item)}`)
		return itemData.version
	}
	
	/** @hidden */
	#recordAndStripItem<I extends NonStripZodObject| z.ZodUnion<[NonStripZodObject, ...NonStripZodObject[]]>, P extends keyof z.infer<I>, 
			S extends keyof z.infer<I>>(item: any, table: Table<I,P,S>, create: boolean): z.infer<typeof table.itemSchema> {
		if (!create && !Number.isInteger(item[table.versionAttributeName]))
			throw new ItemWithoutVersionError(`Found ${table.tableName} item without version attribute "${table.versionAttributeName}": ${JSON.stringify(item)}`)
		const version = create ? 0 : item[table.versionAttributeName]
		delete item[table.versionAttributeName]
		zodValidate(table.itemSchema, item, e => new ItemValidationError(e))
		this.#recordedItems.set(item, {
			table: table,
			existingItem: structuredClone(item),
			version: version,
			delete: false,
			create: create
		})
		return item
	}

	/** @hidden */
	async #handleQueryOrScan<I extends NonStripZodObject| z.ZodUnion<[NonStripZodObject, ...NonStripZodObject[]]>, P extends keyof MergeUnion<z.infer<I>>, 
			S extends keyof MergeUnion<z.infer<I>>>(params: {
		index: Table<I,P,S> | Gsi<I,P,S>
        commandInput: QueryCommandInput | ScanCommandInput,
        get: (input: QueryCommandInput | ScanCommandInput) => Promise<QueryCommandOutput | ScanCommandOutput>,
		limit: number | undefined,
        resumeKey: string | undefined,
		invalidResumeKeyErrorOverride: ((e: InvalidResumeKeyError) => Error) | undefined
	}): Promise<[Array<z.infer<I>>, string | undefined]> {
		const table = getIndexTable(params.index)
		const itemsPagesIterator = new ItemsPagesIterator({
			commandInput: params.commandInput,
			get: params.get,
			limit: params.limit,
			lastEvaluatedKey: decodeResumeKey(params.resumeKey, getLastEvaluatedKeySchema(params.index), params.invalidResumeKeyErrorOverride)
		})
		const items: Array<z.infer<I>> = []
		while (itemsPagesIterator.hasNext()) {
			const page = await itemsPagesIterator.next()
			const incompleteItems: Array<Record<string,any>> = []
			page.forEach(item => {
				try {
					items.push(this.#recordAndStripItem(item, table, false))
				} catch (error) {
					if (isGsi(params.index) && 
						((error as any).name === "ItemWithoutVersionError")) {
						incompleteItems.push(item)
					} else {
						throw error
					}
				}
			})
			const incompleteItemKeys: any = incompleteItems.map(item => Object.fromEntries(Object.entries(item).filter(attr => table.keyAttributeNames.includes(attr[0]))))
			items.push(...(await this.getItems({ table: table, keys: incompleteItemKeys, itemNotFoundErrorOverride: () => undefined })))
		}
		return [
			items,
			encodeResumeKey(itemsPagesIterator.lastEvaluatedKey)
		]
	}
}
