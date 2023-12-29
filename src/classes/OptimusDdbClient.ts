import { DynamoDBClient, DynamoDBClientConfig, TransactionCanceledException } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, BatchGetCommand, TransactWriteCommand, ScanCommand, QueryCommand, 
	QueryCommandInput, ScanCommandInput } from "@aws-sdk/lib-dynamodb"
import { ObjectShape, ShapeToType, validateDataShape } from "shape-tape"
import { AnyToNever, FilterConditionsFor, InvalidNextTokenError, ItemNotFoundError, ItemShapeValidationError, 
	OptimisticLockError, PartitionKeyCondition, ShapeDictionary, SortKeyCondition, UnprocessedKeysError } from "../Types"
import { decodeNextToken, encodeNextToken, getDynamoDbExpression, getIndexTable, getItemsPages, 
	getLastEvaluatedKeyShape } from "../Utilities"
import { ExpressionBuilder } from "./ExpressionBuilder"
import { Table } from "./Table"
import { Gsi } from "./Gsi"

type ItemData = {
	table: Table<any, any, any>,
	existingKey: Record<string, any>,
	version: number,
	delete: boolean,
	create: boolean
}

export class OptimusDdbClient {
	#recordedItems: WeakMap<any, ItemData>
	#ddbDocumentClient: DynamoDBDocumentClient
	constructor(params?: {
		dynamoDbClientConfig?: DynamoDBClientConfig
	}) {
		this.#recordedItems = new WeakMap()
		this.#ddbDocumentClient = DynamoDBDocumentClient.from(new DynamoDBClient({...params?.dynamoDbClientConfig}), {
			marshallOptions: {
				removeUndefinedValues: true
			}
		})
	}

	draftItem<I extends ShapeDictionary, P extends keyof I, S extends keyof I>(params: {
		table: Table<I,P,S>,
		item: ShapeToType<typeof params.table.itemShape>
	}): ShapeToType<typeof params.table.itemShape> {
		return this.#recordAndStripItem({ ...params.item }, params.table, true)
	}

	async getItem<I extends ShapeDictionary, P extends keyof I, S extends keyof I, E extends Error | undefined = Error>(params: {
		table: Table<I,P,S>,
		key: { [T in P]: ShapeToType<I[P]> } & { [T in S]: ShapeToType<I[S]> }
		itemNotFoundErrorOverride?: (e: ItemNotFoundError) => E
	}): Promise<E extends Error ? ShapeToType<ObjectShape<I>> : ShapeToType<ObjectShape<I>> | undefined> {
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
				return undefined as E extends Error ? ShapeToType<ObjectShape<I>> : ShapeToType<ObjectShape<I>> | undefined
			}
		} else {
			return this.#recordAndStripItem(item, params.table, false) as ShapeToType<typeof params.table.itemShape>
		}
	}

	async getItems<I extends ShapeDictionary, P extends keyof I, S extends keyof I>(params: {
		table: Table<I,P,S>,
		keys: Array<{ [T in P]: ShapeToType<I[P]> } & { [T in S]: ShapeToType<I[S]> }>,
		itemNotFoundErrorOverride?: (e: ItemNotFoundError) => Error | undefined
	}): Promise<Array<ShapeToType<ObjectShape<I>>>> {
		if (params.keys.length === 0) return []
		const res = await this.#ddbDocumentClient.send(new BatchGetCommand({
			RequestItems: {
				[params.table.tableName]: {
					Keys: params.keys,
					ConsistentRead: true
				}
			}
		}))
		const items = res.Responses![params.table.tableName]
		if (res.UnprocessedKeys && Object.values(res.UnprocessedKeys).length > 0)
			throw new UnprocessedKeysError({ unprocessedKeys: Object.values(res.UnprocessedKeys).map(x => x.Keys!) })
		if (items.length !== params.keys.length) {
			const unfoundItemKeys = params.keys.filter(key => !items.find(item => {
				return Object.entries(key).filter(keyAttr => item[keyAttr[0]] === keyAttr[1]).length === Object.entries(key).length
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
		return items.map(item => this.#recordAndStripItem(item, params.table, false))
	}
	
	async queryItems<I extends ShapeDictionary, P extends keyof I, S extends keyof I, L extends number | undefined = undefined>(params: {
		index: Table<I,P,S> | Gsi<I,P,S>,
		partitionKeyCondition: PartitionKeyCondition<P, ShapeToType<I[P]>>
		sortKeyCondition?: AnyToNever<ShapeToType<I[S]>> extends never ? never : SortKeyCondition<S, ShapeToType<I[S]>>,
		filterConditions?: Array<FilterConditionsFor<I,P,S>>,
		scanIndexForward?: boolean,
		limit?: L,
		nextToken?: string,
		invalidNextTokenErrorOverride?: (e: InvalidNextTokenError) => Error
	}): Promise<[Array<ShapeToType<ObjectShape<I>>>, L extends number ? string | undefined : undefined]> {
		const queryCommandInput: QueryCommandInput = {
			TableName: getIndexTable(params.index).tableName,
			IndexName: params.index instanceof Gsi ? params.index.indexName : undefined,
			ConsistentRead: params.index instanceof Table,
			...getDynamoDbExpression({
				partitionKeyCondition: params.partitionKeyCondition,
				sortKeyCondition: params.sortKeyCondition,
				filterConditions: params.filterConditions !== undefined ? params.filterConditions : []
			}),
			ScanIndexForward: params.scanIndexForward
		}
		const [items, lastEvaluatedKey] = await getItemsPages({
			commandInput: queryCommandInput,
			get: input => this.#ddbDocumentClient.send(new QueryCommand(input)),
			limit: params.limit,
			lastEvaluatedKey: decodeNextToken(params.nextToken, getLastEvaluatedKeyShape(params.index),
				params.invalidNextTokenErrorOverride)
		})
		return [
			items.map(item => this.#recordAndStripItem(item, getIndexTable(params.index), false)),
			encodeNextToken(lastEvaluatedKey) as L extends number ? string | undefined : undefined
		]
	}
	
	async scanItems<I extends ShapeDictionary, P extends keyof I, S extends keyof I, L extends number | undefined = undefined>(params: {
		index: Table<I,P,S> | Gsi<I,P,S>,
		filterConditions?: Array<FilterConditionsFor<I,never,never>>,
		limit?: L,
		nextToken?: string,
		invalidNextTokenErrorOverride?: (e: InvalidNextTokenError) => Error
	}): Promise<[Array<ShapeToType<ObjectShape<I>>>, L extends number ? string | undefined : undefined]> {
		const scanCommandInput: ScanCommandInput = {
			TableName: getIndexTable(params.index).tableName,
			IndexName: params.index instanceof Gsi ? params.index.indexName : undefined,
			ConsistentRead: params.index instanceof Table,
			...getDynamoDbExpression({
				filterConditions: params.filterConditions !== undefined ? params.filterConditions : []
			})
		}
		const [items, lastEvaluatedKey] = await getItemsPages({
			commandInput: scanCommandInput,
			get: input => this.#ddbDocumentClient.send(new ScanCommand(input)),
			limit: params.limit,
			lastEvaluatedKey: decodeNextToken(params.nextToken, getLastEvaluatedKeyShape(params.index),
				params.invalidNextTokenErrorOverride)
		})
		return [
			items.map(item => this.#recordAndStripItem(item, getIndexTable(params.index), false)),
			encodeNextToken(lastEvaluatedKey) as L extends number ? string | undefined : undefined
		]
	}
	
	async commitItems(params: {
		items: Array<any>,
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
	
	markItemForDeletion(params: { item: any }) {
		if (!this.#recordedItems.has(params.item)) throw new Error(`Unrecorded item cannot be marked for deletion: ${JSON.stringify(params.item)}`)
		if (this.#recordedItems.get(params.item)!.delete) throw new Error(`Item is already marked for deletion: ${JSON.stringify(params.item)}`)
		this.#recordedItems.get(params.item)!.delete = true
	}

	getItemVersion(params: { item: any }): number {
		const itemData = this.#recordedItems.get(params.item)
		if (itemData === undefined)
			throw new Error(`Cannot get version for unrecorded item: ${JSON.stringify(params.item)}`)
		return itemData.version
	}
	
	#recordAndStripItem<I extends ShapeDictionary, P extends keyof I, S extends keyof I>
			(item: any, table: Table<I,P,S>, create: boolean): ShapeToType<typeof table.itemShape> {
		if (!create && !Number.isInteger(item[table.versionAttribute]))
			throw new Error(`Found ${table.tableName} item without version attribute "${table.versionAttribute}": ${JSON.stringify(item)}`)
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
	#getUpdateDynamoDbExpression<I extends ShapeDictionary>
			(item: ShapeToType<ObjectShape<I>>, itemData: ItemData) {
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
}
