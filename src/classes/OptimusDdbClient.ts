import { DynamoDBClient, DynamoDBClientConfig, TransactionCanceledException } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, BatchGetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb"
import { paginateQuery, paginateScan } from "@aws-sdk/lib-dynamodb"
import { DictionaryShape, ShapeToType, validateShape } from "shape-tape"
import { AnyToNever, ConditionalType, FilterConditionsFor, ItemNotFoundError, ItemsNotFoundError, OptimisticLockError, PartitionKeyCondition,
	ShapeDictionary, SortKeyCondition, UnprocessedKeysError } from "../Types"
import { getDynamoDbExpression } from "../Utilities"
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
	#recordedItems: Map<any, ItemData>
	#ddbDocumentClient: DynamoDBDocumentClient
	constructor(props?: {
		dynamoDbClientConfig?: DynamoDBClientConfig
	}) {
		this.#recordedItems = new Map()
		this.#ddbDocumentClient = DynamoDBDocumentClient.from(new DynamoDBClient({...props?.dynamoDbClientConfig}))
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
				props.itemNotFoundErrorOverride(new ItemNotFoundError(props.key))
			) : (
				new ItemNotFoundError(props.key)
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
		itemsNotFoundErrorOverride?: (e: ItemsNotFoundError) => Error
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
			throw new UnprocessedKeysError(Object.values(res.UnprocessedKeys).map(x => x.Keys!))
		if (items.length !== props.keys.length) {
			const unfoundItemKeys = props.keys.filter(key => !items.find(item => {
				Object.entries(key).filter(keyAttr => item[keyAttr[0]] === keyAttr[1]).length === Object.entries(key).length
			}))
			throw props.itemsNotFoundErrorOverride ? (
				props.itemsNotFoundErrorOverride(new ItemsNotFoundError(unfoundItemKeys))
			) : (
				new ItemNotFoundError(unfoundItemKeys)
			)
		}
		return items.map(item => this.#recordAndStripItem(item, props.table, false))
	}
	
	async queryItems<I extends ShapeDictionary, P extends keyof I, S extends keyof I>(props: {
		index: Table<I,P,S> | Gsi<I,P,S>,
		partitionKeyCondition: PartitionKeyCondition<P, ShapeToType<I[P]>>
		sortKeyCondition?: ConditionalType<SortKeyCondition<S, ShapeToType<I[S]>>, AnyToNever<ShapeToType<I[S]>>>,
		filterConditions?: Array<FilterConditionsFor<I>>
	}): Promise<Array<ShapeToType<DictionaryShape<I>>>> {
		const paginator = paginateQuery({ client: this.#ddbDocumentClient }, {
			TableName: props.index.table.tableName,
			IndexName: props.index instanceof Gsi ? props.index.indexName : undefined,
			ConsistentRead: props.index instanceof Table,
			...getDynamoDbExpression({
				partitionKeyCondition: props.partitionKeyCondition,
				sortKeyCondition: props.sortKeyCondition,
				filterConditions: props.filterConditions ? props.filterConditions : []
			})
		})
		const items = []
		for await (const page of paginator) items.push(...page.Items!)
		return items.map(item => this.#recordAndStripItem(item, props.index.table, false))
	}
	
	async scanItems<I extends ShapeDictionary, P extends keyof I, S extends keyof I>(props: {
		index: Table<I,P,S> | Gsi<I,P,S>,
		filterConditions?: Array<FilterConditionsFor<I>>
	}): Promise<Array<ShapeToType<DictionaryShape<I>>>> {
		const paginator = paginateScan({ client: this.#ddbDocumentClient }, {
			TableName: props.index.table.tableName,
			IndexName: props.index instanceof Gsi ? props.index.indexName : undefined,
			ConsistentRead: props.index instanceof Table,
			...getDynamoDbExpression({
				filterConditions: props.filterConditions ? props.filterConditions : []
			})
		})
		const items = []
		for await (const page of paginator) items.push(...page.Items!)
		return items.map(item => this.#recordAndStripItem(item, props.index.table, false))
	}
	
	draftItem<I extends ShapeDictionary, P extends keyof I, S extends keyof I>(props: {
		table: Table<I,P,S>,
		item: ShapeToType<typeof props.table.itemShape>
	}): ShapeToType<typeof props.table.itemShape> {
		return this.#recordAndStripItem({ ...props.item }, props.table, true)
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
			validateShape(item, itemData.table.itemShape)
			Object.keys(item).forEach(key => {
				if (item[key] === undefined) delete item[key]
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
				const versionedItem = {
					...item,
					version: 0
				}
				return {
					Put: {
						TableName: itemData.table.tableName,
						Item: versionedItem,
						...getDynamoDbExpression({
							conditionConditions: [itemData.table.partitionKey, "doesn't exist"]
						})
					}
				}
			} else {
				const versionedItem = {
					...item,
					version: itemData.version + 1
				}
				itemData.table.keyAttributes.map(keyAttr => delete versionedItem[keyAttr])
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
				if (exception.CancellationReasons && exception.CancellationReasons.length > 0
					&& exception.CancellationReasons.filter(reason => reason.Code !== "ConditionalCheckFailed").length === 0) {
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
				itemData.version = 0
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
		const version = item.version
		delete item.version
		const validatedItem: ShapeToType<typeof table.itemShape> = validateShape(item, table.itemShape)
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
		const set = itemData.table.attributes.concat("version")
			.filter(key => item[key as string] !== undefined)
			.map(key => `${builder.addName(key as string)} = ${builder.addValue(item[key as string])}`).join(", ")
		const remove = itemData.table.attributes
			.filter(key => item[key as string] === undefined && !itemData.table.keyAttributes.includes(key as string))
			.map(key => builder.addName(key as string)).join(", ")
		return {
			UpdateExpression: remove.length > 0 ? `SET ${set} REMOVE ${remove}` : `SET ${set}`,
			ConditionExpression: `attribute_exists(${builder.addName("version")}) AND `
				+`(${builder.addName("version")} = ${builder.addValue(itemData.version)})`,
			ExpressionAttributeNames: builder.attributeNames,
			ExpressionAttributeValues: builder.attributeValues
		}
	}
}
