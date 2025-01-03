import { OPTIMUS_OPERATORS } from "./Constants"
import { ExpressionBuilder } from "./classes/ExpressionBuilder"
import { ConditionCondition, FilterCondition, InvalidResumeKeyError, PartitionKeyCondition, SortKeyCondition,
	MergeUnion, TableRelationshipViolationError, 
	TableRelationshipType,
	TableRelationship,
	PerKeyItemChange,
	NonStripZodObject,
	OneOrArray} from "./Types"
import * as z from "zod"
import { Table } from "./classes/Table"
import { Gsi } from "./classes/Gsi"
import { ItemData } from "./classes/OptimusDdbClient"

export function plurality(num: number) {
	return num === 1 ? "" : "s"
}

export function getUpdateDynamoDbExpression<I extends NonStripZodObject | z.ZodUnion<[NonStripZodObject, ...NonStripZodObject[]]>>
			(table: Table<any, any, any>, item: z.infer<I>, existingVersion: number) {
	const builder: ExpressionBuilder = new ExpressionBuilder()
	const set = table.attributeNames
		.filter(key => item[key as string] !== undefined && !table.keyAttributeNames.includes(key as string))
		.map(key => `${builder.addName(key as string)} = ${builder.addValue(item[key as string])}`)
		.concat(`${builder.addName(table.versionAttributeName)} = ${builder.addValue(existingVersion+1)}`)
		.join(", ")
	const remove = table.attributeNames
		.filter(key => item[key as string] === undefined && !table.keyAttributeNames.includes(key as string))
		.map(key => builder.addName(key as string))
		.join(", ")
	return {
		UpdateExpression: remove.length > 0 ? `SET ${set} REMOVE ${remove}` : `SET ${set}`,
		ConditionExpression: `(${builder.addName(table.versionAttributeName)} = ${builder.addValue(existingVersion)})`,
		ExpressionAttributeNames: builder.attributeNames,
		ExpressionAttributeValues: builder.attributeValues
	}
}

export function getDynamoDbExpression(params: {
	partitionKeyCondition?: PartitionKeyCondition<any,any>,
	sortKeyCondition?: SortKeyCondition<any,any>,
	filterCondition?: FilterCondition<any>,
	conditionConditions?: Array<ConditionCondition<any,any>>
}) {
	const builder: ExpressionBuilder = new ExpressionBuilder()
	const keyConditions = [
		...(params.partitionKeyCondition ? [params.partitionKeyCondition] : []),
		...(params.sortKeyCondition ? [params.sortKeyCondition] : [])
	]
	const keyConditionExpression = keyConditions
		.map(condition => getDynamoDbConditionExpressionString(condition, builder))
		.join(" AND ")
	const filterConditionExpression = params.filterCondition !== undefined ? getDynamoDbConditionExpressionString(params.filterCondition, builder) : undefined
	const conditionConditions = params.conditionConditions !== undefined ? params.conditionConditions : []
	const conditionConditionExpression = conditionConditions
		.map(condition => getDynamoDbConditionExpressionString(condition, builder))
		.join(" AND ")
	const attributeNames = builder.attributeNames
	const attributeValues = builder.attributeValues
	return {
		KeyConditionExpression: keyConditions.length > 0 ? keyConditionExpression : undefined,
		FilterExpression: filterConditionExpression,
		ConditionExpression: conditionConditions.length > 0 ? conditionConditionExpression : undefined,
		ExpressionAttributeNames: Object.entries(attributeNames).length > 0 ? attributeNames : undefined,
		ExpressionAttributeValues: Object.entries(attributeValues).length > 0 ? attributeValues : undefined,
	}
}

export function getDynamoDbConditionExpressionString<L,R>
		(condition: PartitionKeyCondition<any,any> | SortKeyCondition<any,any> | FilterCondition<any>,
		builder: ExpressionBuilder): string {
	if (condition.length === 1) {
		return `(${getDynamoDbConditionExpressionString(condition[0], builder)})`
	} else if (condition[1] === "exists" || condition[1] === "doesn't exist") {
		const functionName = {
			"exists": "attribute_exists",
			"doesn't exist": "attribute_not_exists"
		}[condition[1]]
		return `${functionName}(${builder.addName(condition[0])})`
	} else if (condition[1] === "in") {
		return [
			builder.addName(condition[0]),
			OPTIMUS_OPERATORS[condition[1]],
			`(${condition[2].map(x => builder.addValue(x)).join(", ")})`
		].join(" ")
	} else if (condition[1] === "begins with" || condition[1] === "contains") {
		return `${OPTIMUS_OPERATORS[condition[1]]}(${builder.addName(condition[0])}, ${builder.addValue(condition[2])})`
	} else if (condition.length === 3) {
		if (Array.isArray(condition[0]) && (condition[1] === "or" || condition[1] === "and") && Array.isArray(condition[2])) {
			return [
				getDynamoDbConditionExpressionString(condition[0], builder),
				OPTIMUS_OPERATORS[condition[1]],
				getDynamoDbConditionExpressionString(condition[2], builder)
			].join(" ")
		} else {
			return [
				builder.addName(condition[0]),
				OPTIMUS_OPERATORS[condition[1]],
				builder.addValue(condition[2])
			].join(" ")
		}
	} else if (condition.length === 5) {
		return [
			builder.addName(condition[0]),
			OPTIMUS_OPERATORS[condition[1]],
			builder.addValue(condition[2]),
			OPTIMUS_OPERATORS[condition[3]],
			builder.addValue(condition[4])
		].join(" ")
	} else {
		throw new Error(`Unexpected condition ${JSON.stringify(condition)}.`)
	}
}

export function encodeResumeKey<T extends Record<string, any>>(lastEvaluatedKey: T | undefined): string | undefined {
	if (lastEvaluatedKey === undefined) return undefined
	return JSON.stringify(lastEvaluatedKey)
}

export function decodeResumeKey<T extends z.ZodTypeAny>(resumeKey: string | undefined, keySchema: T,
		invalidResumeKeyErrorOverride?: (e: InvalidResumeKeyError) => Error)
		: z.infer<typeof keySchema> | undefined {
	if (resumeKey === undefined) return undefined
	try {
		return zodValidate(keySchema, JSON.parse(resumeKey))
	} catch (error) {
		if (invalidResumeKeyErrorOverride !== undefined) {
			throw invalidResumeKeyErrorOverride(new InvalidResumeKeyError())
		} else {
			throw new InvalidResumeKeyError()
		}
	}
}

export function getLastEvaluatedKeySchema(index: Table<any,any,any> | Gsi<any,any,any>): z.ZodTypeAny {
	const table = getIndexTable(index)
	return z.strictObject({
		[table.partitionKey]: getItemSchemaPropertyValueSchema(table, table.partitionKey),
		...(table.sortKey !== undefined ? (
			{ [table.sortKey]: getItemSchemaPropertyValueSchema(table, table.sortKey) }
		) : (
			{}
		)),
		...(isGsi(index) ? (
			{
				[index.partitionKey]: getItemSchemaPropertyValueSchema(table, index.partitionKey),
				...(index.sortKey !== undefined ? (
					{ [index.sortKey]: getItemSchemaPropertyValueSchema(table, index.sortKey) }
				) : (
					{}
				))
			}
		) : (
			{}
		))
	})
}

function getItemSchemaPropertyValueSchema(table: Table<any,any,any>, attributeName: string): z.ZodTypeAny {
	if (table.itemSchema.shape !== undefined) {
		return table.itemSchema.shape[attributeName]
	} else {
		const specificMembers: Array<z.ZodTypeAny> = (table.itemSchema.options as Array<NonStripZodObject>)
			.filter(member => Object.keys(member.shape).includes(attributeName))
			.map(member => member.shape[attributeName])
		return z.union(specificMembers as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]])
	}
}

export function getIndexTable<I extends NonStripZodObject | z.ZodUnion<[NonStripZodObject, ...NonStripZodObject[]]>, P extends keyof MergeUnion<z.infer<I>>, S extends keyof MergeUnion<z.infer<I>> = never>
		(index: Table<I,P,S> | Gsi<I,P,S>): Table<I,P,S> {
	if (isGsi(index)) {
		return (index as Gsi<I,P,S>).table
	} else {
		return index as Table<I,P,S>
	}
}

export function isGsi(index: Table<any,any,any> | Gsi<any,any,any>): boolean {
	return (index as Gsi<any,any,any>).indexName !== undefined
}

export function flipRelationshipType(relationshipType: TableRelationshipType): TableRelationshipType {
	if (relationshipType === TableRelationshipType.ONE_TO_MANY) return TableRelationshipType.MANY_TO_ONE
	if (relationshipType === TableRelationshipType.MANY_TO_ONE) return TableRelationshipType.ONE_TO_MANY
	return relationshipType
}

export function getItemKey(table: Table<any, any, any>, item: Record<string, any>): Record<string, any> {
	return Object.fromEntries(table.keyAttributeNames.map(keyAttr => [keyAttr, item[keyAttr]]))
}

export function validateRelationshipsOnCommit(perKeyItemChanges: Array<PerKeyItemChange>) {
	perKeyItemChanges.forEach(itemChange => {
		itemChange.table.relationships.forEach(relationship => {
			const newestItem = (itemChange.newItem ?? itemChange.oldItem)!
			if (relationship.itemExemption !== undefined && relationship.itemExemption(newestItem) === true) return
			const mkError = () => new TableRelationshipViolationError({
				item: newestItem,
				tableRelationshipType: relationship.type,
				tables: [itemChange.table, relationship.peerTable]
			})
			const itemKey = getItemKey(itemChange.table, itemChange.key)
			const existingForeignKeys = getForeignKeys(relationship.itemForeignKeys, itemChange.oldItem)
			const latestForeignKeys = getForeignKeys(relationship.itemForeignKeys, itemChange.newItem)
			const removedForeignKeys = existingForeignKeys
				.filter(existingForeignKey => !includes(latestForeignKeys, existingForeignKey, shallowObjectEq))
			const addedForeignKeys = latestForeignKeys
				.filter(latestForeignKey => !includes(existingForeignKeys, latestForeignKey, shallowObjectEq))
			;[...removedForeignKeys, ...addedForeignKeys].forEach(changedForeignKey => {
				const added = includes(addedForeignKeys, changedForeignKey, shallowObjectEq)
				const peerItemChange = perKeyItemChanges.find(peerItemChange => {
					const peerItem = added ? peerItemChange.newItem : peerItemChange.oldItem
					return peerItemChange.table === relationship.peerTable && peerItem !== undefined &&
						shallowObjectEq(getItemKey(peerItemChange.table, peerItem), changedForeignKey)
				})
				if (peerItemChange === undefined) throw mkError()
				if (doesPeerPointBack(relationship, peerItemChange, itemKey) !== added) throw mkError()
			})
		})
	})
}

export function getForeignKeys(fnc: (item: Record<string, any>) => OneOrArray<Record<string, any>>, item: Record<string, any> | undefined): Array<Record<string, any>> {
	if (item === undefined) {
		return []
	} else {
		const foreignKeys = fnc(item)
		return Array.isArray(foreignKeys) ? foreignKeys : [foreignKeys]
	}
}

export function doesPeerPointBack(relationship: TableRelationship<any>, peerItemChange: PerKeyItemChange,
		itemKey: Record<string, any>): boolean {
	const foreignKeys = getForeignKeys(relationship.peerItemForeignKeys, peerItemChange.newItem)
	return includes(foreignKeys, itemKey, shallowObjectEq)
}

export function optimusCommitItemsToPerKeyItemChanges(recordedItems: WeakMap<Record<string, any>, ItemData>,
		items: Array<Record<string, any>>): Array<PerKeyItemChange> {
	const existingDdbItemVersions = items.map(item => {
		const itemData = recordedItems.get(item)!
		return {
			table: itemData.table,
			key: getItemKey(itemData.table, itemData.existingItem),
			version: itemData.version
		}
	})
	const existingItems = items.flatMap(item => {
		const itemData = recordedItems.get(item)!
		return itemData.create ? [] : [{ table: itemData.table, item: itemData.existingItem }]
	})
	const latestItems = items.flatMap(item => {
		const itemData = recordedItems.get(item)!
		return itemData.delete ? [] : [{ table: itemData.table, item: item }]
	})
	const allKeyProfiles: Array<{
		table: Table<any,any,any>
		key: Record<string, any>
	}> = filterUnique(
		[...existingItems, ...latestItems].map(itemProfile => ({ table: itemProfile.table, key: getItemKey(itemProfile.table, itemProfile.item) })),
		(a, b) => a.table === b.table && itemKeyEq(a.table, a.key, b.key)
	)
	return allKeyProfiles.map(keyProfile => ({
		table: keyProfile.table,
		key: keyProfile.key,
		existingDdbItemVersion: existingDdbItemVersions
			.find(entry => entry.table == keyProfile.table && itemKeyEq(keyProfile.table, keyProfile.key, entry.key))
			?.version,
		oldItem: existingItems.find(existingItem => existingItem.table === keyProfile.table && itemKeyEq(keyProfile.table, keyProfile.key, existingItem.item))?.item,
		newItem: latestItems.find(latestItem => latestItem.table === keyProfile.table && itemKeyEq(keyProfile.table, keyProfile.key, latestItem.item))?.item
	}))
}

export function filterUnique<T>(array: Array<T>, eq: (a: T, b: T) => boolean): Array<T> {
	const uniqued: Array<T> = []
	array.forEach(a => {
		if (uniqued.find(b => eq(a, b)) === undefined) {
			uniqued.push(a)
		}
	})
	return uniqued
}

export function itemKeyEq(table: Table<any, any, any>, a: Record<string, any>, b: Record<string, any>): boolean {
	return table.keyAttributeNames.filter(keyAttrName => a[keyAttrName] !== b[keyAttrName]).length === 0
}

export function includes<T>(array: Array<T>, target: T, eq: (a: T, b: T) => boolean): boolean {
	return array.find(child => eq(child, target)) !== undefined
}

export function shallowObjectEq(a: Record<string, any>, b: Record<string, any>) {
	const aKeys = Object.keys(a)
	const bKeys = Object.keys(b)
	if (aKeys.length !== bKeys.length) return false
	return aKeys.every(key => a[key] === b[key])
}

export function zodValidate<T extends z.ZodTypeAny>(schema: T, data: any, errorMapping?: (e: z.ZodError) => Error): z.infer<T> {
	try {
		schema.parse(data)
		return data
	} catch (error) {
		if (error instanceof z.ZodError && errorMapping !== undefined) {
			throw errorMapping(error)
		} else {
			throw error
		}
	}
}
