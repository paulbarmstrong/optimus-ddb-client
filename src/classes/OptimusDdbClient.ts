import { DynamoDBClient, DynamoDBClientConfig, TransactionCanceledException } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, BatchGetCommand, TransactWriteCommand, ScanCommand, QueryCommand, QueryCommandInput,
	ScanCommandInput } from "@aws-sdk/lib-dynamodb"
import { DictionaryShape, ShapeToType, validateObjectShape } from "shape-tape"
import { AnyToNever, FilterConditionsFor, InvalidNextTokenError, ItemNotFoundError, ItemShapeValidationError, OptimisticLockError, PartitionKeyCondition,
	ShapeDictionary, SortKeyCondition, UnprocessedKeysError } from "../Types"
import { decodeNextToken, encodeNextToken, getDynamoDbExpression, getItemsPages, getLastEvaluatedKeyShape } from "../Utilities"
import { ExpressionBuilder } from "./ExpressionBuilder"
import { Table } from "./Table"
import { Gsi } from "./Gsi"

type ItemData = {
	table: Table<any, any, any>,
	key: Record<string, any>,
	version: number,
	delete: boolean,
	create: boolean
}

export class OptimusDdbClient {
	#recordedItems: WeakMap<any, ItemData>
	#ddbDocumentClient: DynamoDBDocumentClient
	constructor(props?: {
		dynamoDbClientConfig?: DynamoDBClientConfig
	}) {
		this.#recordedItems = new WeakMap()
		this.#ddbDocumentClient = DynamoDBDocumentClient.from(new DynamoDBClient({...props?.dynamoDbClientConfig}), {
			marshallOptions: {
				removeUndefinedValues: true
			}
		})
	}

	draftItem<I extends ShapeDictionary, P extends keyof I, S extends keyof I>(props: {
		table: Table<I,P,S>,
		item: ShapeToType<typeof props.table.itemShape>
	}): ShapeToType<typeof props.table.itemShape> {
		return this.#recordAndStripItem({ ...props.item }, props.table, true)
	}

	async getItem<I extends ShapeDictionary, P extends keyof I, S extends keyof I, E extends Error | undefined = Error>(props: {
		table: Table<I,P,S>,
		key: { [T in P]: ShapeToType<I[P]> } & { [T in S]: ShapeToType<I[S]> }
		itemNotFoundErrorOverride?: (e: ItemNotFoundError) => E
	}): Promise<E extends Error ? ShapeToType<DictionaryShape<I>> : ShapeToType<DictionaryShape<I>> | undefined> {
		const item = (await this.#ddbDocumentClient.send(new GetCommand({
			TableName: props.table.tableName,
			Key: props.key,
			ConsistentRead: true
		}))).Item
		if (item === undefined) {
			const error = props.itemNotFoundErrorOverride ? (
				props.itemNotFoundErrorOverride(new ItemNotFoundError({ itemKeys: [props.key] }))
			) : (
				new ItemNotFoundError({ itemKeys: [props.key] })
			)
			if (error instanceof Error) {
				throw error
			} else {
				return undefined as E extends Error ? ShapeToType<DictionaryShape<I>> : ShapeToType<DictionaryShape<I>> | undefined
			}
		} else {
			return this.#recordAndStripItem(item, props.table, false) as ShapeToType<typeof props.table.itemShape>
		}
	}

	async getItems<I extends ShapeDictionary, P extends keyof I, S extends keyof I>(props: {
		table: Table<I,P,S>,
		keys: Array<{ [T in P]: ShapeToType<I[P]> } & { [T in S]: ShapeToType<I[S]> }>,
		itemNotFoundErrorOverride?: (e: ItemNotFoundError) => Error | undefined
	}): Promise<Array<ShapeToType<DictionaryShape<I>>>> {
		if (props.keys.length === 0) return []
		const res = await this.#ddbDocumentClient.send(new BatchGetCommand({
			RequestItems: {
				[props.table.tableName]: {
					Keys: props.keys,
					ConsistentRead: true
				}
			}
		}))
		const items = res.Responses![props.table.tableName]
		if (res.UnprocessedKeys && Object.values(res.UnprocessedKeys).length > 0)
			throw new UnprocessedKeysError({ unprocessedKeys: Object.values(res.UnprocessedKeys).map(x => x.Keys!) })
		if (items.length !== props.keys.length) {
			const unfoundItemKeys = props.keys.filter(key => !items.find(item => {
				return Object.entries(key).filter(keyAttr => item[keyAttr[0]] === keyAttr[1]).length === Object.entries(key).length
			}))
			const error = props.itemNotFoundErrorOverride ? (
				props.itemNotFoundErrorOverride(new ItemNotFoundError({ itemKeys: unfoundItemKeys }))
			) : (
				new ItemNotFoundError({ itemKeys: unfoundItemKeys })
			)
			if (error instanceof Error) {
				throw error
			}
		}
		return items.map(item => this.#recordAndStripItem(item, props.table, false))
	}
	
	async queryItems<I extends ShapeDictionary, P extends keyof I, S extends keyof I, L extends number | undefined = undefined>(props: {
		index: Table<I,P,S> | Gsi<I,P,S>,
		partitionKeyCondition: PartitionKeyCondition<P, ShapeToType<I[P]>>
		sortKeyCondition?: AnyToNever<ShapeToType<I[S]>> extends never ? never : SortKeyCondition<S, ShapeToType<I[S]>>,
		filterConditions?: Array<FilterConditionsFor<I,P,S>>,
		scanIndexForward?: boolean,
		limit?: L,
		nextToken?: string,
		invalidNextTokenErrorOverride?: (e: InvalidNextTokenError) => Error
	}): Promise<[Array<ShapeToType<DictionaryShape<I>>>, L extends number ? string | undefined : undefined]> {
		const params: QueryCommandInput = {
			TableName: props.index.table.tableName,
			IndexName: props.index instanceof Gsi ? props.index.indexName : undefined,
			ConsistentRead: props.index instanceof Table,
			...getDynamoDbExpression({
				partitionKeyCondition: props.partitionKeyCondition,
				sortKeyCondition: props.sortKeyCondition,
				filterConditions: props.filterConditions ? props.filterConditions : []
			}),
			ScanIndexForward: props.scanIndexForward
		}
		const [items, lastEvaluatedKey] = await getItemsPages({
			params: params,
			get: input => this.#ddbDocumentClient.send(new QueryCommand(input)),
			limit: props.limit,
			lastEvaluatedKey: decodeNextToken(props.nextToken, getLastEvaluatedKeyShape(props.index),
				props.invalidNextTokenErrorOverride)
		})
		return [
			items.map(item => this.#recordAndStripItem(item, props.index.table, false)),
			encodeNextToken(lastEvaluatedKey) as L extends number ? string | undefined : undefined
		]
	}
	
	async scanItems<I extends ShapeDictionary, P extends keyof I, S extends keyof I, L extends number | undefined = undefined>(props: {
		index: Table<I,P,S> | Gsi<I,P,S>,
		filterConditions?: Array<FilterConditionsFor<I,never,never>>,
		limit?: L,
		nextToken?: string,
		invalidNextTokenErrorOverride?: (e: InvalidNextTokenError) => Error
	}): Promise<[Array<ShapeToType<DictionaryShape<I>>>, L extends number ? string | undefined : undefined]> {
		const params: ScanCommandInput = {
			TableName: props.index.table.tableName,
			IndexName: props.index instanceof Gsi ? props.index.indexName : undefined,
			ConsistentRead: props.index instanceof Table,
			...getDynamoDbExpression({
				filterConditions: props.filterConditions ? props.filterConditions : []
			})
		}
		const [items, lastEvaluatedKey] = await getItemsPages({
			params: params,
			get: input => this.#ddbDocumentClient.send(new ScanCommand(input)),
			limit: props.limit,
			lastEvaluatedKey: decodeNextToken(props.nextToken, getLastEvaluatedKeyShape(props.index),
				props.invalidNextTokenErrorOverride)
		})
		return [
			items.map(item => this.#recordAndStripItem(item, props.index.table, false)),
			encodeNextToken(lastEvaluatedKey) as L extends number ? string | undefined : undefined
		]
	}
	
	async commitItems(props: {
		items: Array<any>,
		optimisticLockErrorOverride?: (e: OptimisticLockError) => Error
	}) {
		if (props.items.length === 0) return
		const transactItems = props.items.map(item => {
			if (!this.#recordedItems.has(item)) throw new Error(`Unrecorded item cannot be committed: ${JSON.stringify(item)}`)
			if (item.version !== undefined) throw new Error(`Item contains illegal version attribute: ${JSON.stringify(item)}`)
			const itemData = this.#recordedItems.get(item)!
			if (Object.keys(itemData.key).filter(attrName => item[attrName] !== itemData.key[attrName]).length > 0)
				throw new Error(`Item key changes aren't supported. key: ${JSON.stringify(itemData.key)}, item: ${JSON.stringify(item)}`)
			validateObjectShape({
				object: item,
				shape: itemData.table.itemShape,
				shapeValidationErrorOverride: e => new ItemShapeValidationError(e)
			})
			if (itemData.delete) {
				return {
					Delete: {
						TableName: itemData.table.tableName,
						Key: itemData.key,
						...getDynamoDbExpression({
							conditionConditions: [
								["version", "exists"],
								["version", "=", itemData.version]
							]
						})
					}
				}
			} else if (itemData.create) {
				return {
					Put: {
						TableName: itemData.table.tableName,
						Item: { ...item, version: itemData.version },
						...getDynamoDbExpression({
							conditionConditions: [[itemData.table.partitionKey, "doesn't exist"]]
						})
					}
				}
			} else {
				return {
					Update: {
						TableName: itemData.table.tableName,
						Key: itemData.key,
						...this.#getUpdateDynamoDbExpression(item, itemData)
					}
				}
			}
		})
		try {
			await this.#ddbDocumentClient.send(new TransactWriteCommand({
				TransactItems: transactItems
			}))
		} catch (error) {
			if ((error as Error).name === "TransactionCanceledException") {
				const exception = error as TransactionCanceledException
				if (exception.CancellationReasons && exception.CancellationReasons
					.filter(reason => reason.Code === "ConditionalCheckFailed").length > 0) {
					throw props.optimisticLockErrorOverride ? (
						props.optimisticLockErrorOverride(new OptimisticLockError())
					) : (
						new OptimisticLockError()
					)
				} else {
					throw new Error(`TransactionCanceledException due to: ${JSON.stringify(exception.CancellationReasons)}`)
				}
			} else {
				throw error
			}
		}
		props.items.forEach(item => {
			const itemData = this.#recordedItems.get(item)!
			if (itemData.create) {
				itemData.create = false
			} else {
				itemData.version = itemData.version + 1
			}
			if (itemData.delete) this.#recordedItems.delete(item)
		})
	}
	
	markItemForDeletion(props: { item: any }) {
		if (!this.#recordedItems.has(props.item)) throw new Error(`Unrecorded item cannot be marked for deletion: ${JSON.stringify(props.item)}`)
		if (this.#recordedItems.get(props.item)!.delete) throw new Error(`Item is already marked for deletion: ${JSON.stringify(props.item)}`)
		this.#recordedItems.get(props.item)!.delete = true
	}

	getItemVersion(props: { item: any }): number {
		if (!this.#recordedItems.has(props.item)) throw new Error(`Cannot get version for unrecorded item: ${JSON.stringify(props.item)}`)
		return this.#recordedItems.get(props.item)!.version
	}
	
	#recordAndStripItem<I extends ShapeDictionary, P extends keyof I, S extends keyof I>
			(item: any, table: Table<I,P,S>, create: boolean): ShapeToType<typeof table.itemShape> {
		if (!create && !Number.isInteger(item.version)) throw new Error(`Item must have verison: ${JSON.stringify(item)}`)
		const version = create ? 0 : item.version
		delete item.version
		const validatedItem: ShapeToType<typeof table.itemShape> = validateObjectShape({
			object: item,
			shape: table.itemShape,
			shapeValidationErrorOverride: e => new ItemShapeValidationError(e)
		})
		this.#recordedItems.set(item, {
			table: table,
			key: Object.fromEntries(table.keyAttributes.map(keyAttr => [keyAttr, item[keyAttr]])),
			version: version,
			delete: false,
			create: create
		})
		return validatedItem
	}
	#getUpdateDynamoDbExpression<I extends ShapeDictionary>
			(item: ShapeToType<DictionaryShape<I>>, itemData: ItemData) {
		const builder: ExpressionBuilder = new ExpressionBuilder()
		const set = itemData.table.attributes
			.filter(key => item[key as string] !== undefined && !itemData.table.keyAttributes.includes(key as string))
			.map(key => `${builder.addName(key as string)} = ${builder.addValue(item[key as string])}`)
			.concat(`${builder.addName("version")} = ${builder.addValue(itemData.version+1)}`)
			.join(", ")
		const remove = itemData.table.attributes
			.filter(key => item[key as string] === undefined && !itemData.table.keyAttributes.includes(key as string))
			.map(key => builder.addName(key as string))
			.join(", ")
		return {
			UpdateExpression: remove.length > 0 ? `SET ${set} REMOVE ${remove}` : `SET ${set}`,
			ConditionExpression: `attribute_exists(${builder.addName("version")}) AND `
				+`(${builder.addName("version")} = ${builder.addValue(itemData.version)})`,
			ExpressionAttributeNames: builder.attributeNames,
			ExpressionAttributeValues: builder.attributeValues
		}
	}
}
