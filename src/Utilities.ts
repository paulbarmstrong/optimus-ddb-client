import { OPTIMUS_OPERATORS } from "./Constants"
import { ExpressionBuilder } from "./classes/ExpressionBuilder"
import { ConditionCondition, FilterCondition, InvalidResumeKeyError, PartitionKeyCondition, SortKeyCondition,
	MergeUnion, TableRelationshipViolationError, 
	TableRelationshipType,
	TableRelationship,
	PerKeyItemChange} from "./Types"
import { ObjectShape, Shape, ShapeToType, UnionShape, s, validateDataShape }  from "shape-tape"
import { Table } from "./classes/Table"
import { Gsi } from "./classes/Gsi"
import { ItemData } from "./classes/OptimusDdbClient"

export function plurality(num: number) {
	return num === 1 ? "" : "s"
}

export function getUpdateDynamoDbExpression<I extends ObjectShape<any,any> | UnionShape<Array<ObjectShape<any,any>>>>
			(table: Table<any, any, any>, item: ShapeToType<I>, existingVersion: number) {
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

export function decodeResumeKey<T extends Shape>(resumeKey: string | undefined, keyShape: T,
		invalidResumeKeyErrorOverride?: (e: InvalidResumeKeyError) => Error)
		: ShapeToType<typeof keyShape> | undefined {
	if (resumeKey === undefined) return undefined
	try {
		return validateDataShape({
			data: JSON.parse(resumeKey),
			shape: keyShape
		})
	} catch (error) {
		if (invalidResumeKeyErrorOverride !== undefined) {
			throw invalidResumeKeyErrorOverride(new InvalidResumeKeyError())
		} else {
			throw new InvalidResumeKeyError()
		}
	}
}

export function getLastEvaluatedKeyShape(index: Table<any,any,any> | Gsi<any,any,any>): Shape {
	const table = getIndexTable(index)
	return s.object({
		[table.partitionKey]: getItemShapePropertyValueShape(table, table.partitionKey),
		...(table.sortKey !== undefined ? (
			{ [table.sortKey]: getItemShapePropertyValueShape(table, table.sortKey) }
		) : (
			{}
		)),
		...(isGsi(index) ? (
			{
				[index.partitionKey]: getItemShapePropertyValueShape(table, index.partitionKey),
				...(index.sortKey !== undefined ? (
					{ [index.sortKey]: getItemShapePropertyValueShape(table, index.sortKey) }
				) : (
					{}
				))
			}
		) : (
			{}
		))
	})
}

function getItemShapePropertyValueShape(table: Table<any,any,any>, attributeName: string): Shape {
	if (table.itemShape.propertyShapes !== undefined) {
		return table.itemShape.propertyShapes[attributeName]
	} else {
		const specificMembers: Array<Shape> = (table.itemShape.memberShapes as Array<ObjectShape<any,any>>)
			.filter(member => Object.keys(member.propertyShapes).includes(attributeName))
			.map(member => member.propertyShapes[attributeName])
		return s.union(specificMembers)
	}
}

export function getIndexTable<I extends ObjectShape<any,any> | UnionShape<Array<ObjectShape<any,any>>>, P extends keyof MergeUnion<ShapeToType<I>>, S extends keyof MergeUnion<ShapeToType<I>> = never>
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

export function getItemKeyPointer(table: Table<any, any, any>, item: Record<string, any>, separator: string): string | number {
	if (table.sortKey === undefined) {
		return item[table.partitionKey]
	} else {
		return `${item[table.partitionKey]}${separator}${item[table.sortKey]}`
	}
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
			const itemKeyPointer = getItemKeyPointer(itemChange.table, itemChange.key, relationship.compositeKeySeparator)
			const existingPointers = getExistingPointers(relationship, itemChange)
			const latestPointers = getLatestPointers(relationship, itemChange)
			const removedPointers: Array<string | number> = existingPointers
				.filter(existingPointer => !latestPointers.includes(existingPointer))
			const addedPointers: Array<string | number> = latestPointers
				.filter(newPointer => !existingPointers.includes(newPointer))
			;[...removedPointers, ...addedPointers].forEach(changedPointer => {
				const added = addedPointers.includes(changedPointer)
				const peerItemChange = perKeyItemChanges.find(peerItemChange => {
					const peerItem = added ? peerItemChange.newItem : peerItemChange.oldItem
					return peerItemChange.table === relationship.peerTable && peerItem !== undefined &&
						getItemKeyPointer(peerItemChange.table, peerItem, relationship.compositeKeySeparator) === changedPointer
				})
				if (peerItemChange === undefined) throw mkError()
				if (doesPeerPointBack(relationship, peerItemChange, itemKeyPointer) !== added) throw mkError()
			})
		})
	})
}

export function getExistingPointers(relationship: TableRelationship, itemChange: PerKeyItemChange): Array<string | number> {
	if (itemChange.oldItem === undefined) {
		return []
	} else {
		if ([TableRelationshipType.ONE_TO_ONE, TableRelationshipType.MANY_TO_ONE].includes(relationship.type)) {
			return [itemChange.oldItem[relationship.pointerAttributeName] as string | number]
		} else {
			return itemChange.oldItem[relationship.pointerAttributeName] as Array<string | number>
		}
	}
}

export function getLatestPointers(relationship: TableRelationship, itemChange: PerKeyItemChange): Array<string | number> {
	if (itemChange.newItem === undefined) {
		return []
	} else {
		if ([TableRelationshipType.ONE_TO_ONE, TableRelationshipType.MANY_TO_ONE].includes(relationship.type)) {
			return [itemChange.newItem[relationship.pointerAttributeName] as string | number]
		} else {
			return itemChange.newItem[relationship.pointerAttributeName] as Array<string | number>
		}
	}
}

export function doesPeerPointBack(relationship: TableRelationship, peerItemChange: PerKeyItemChange,
		itemKeyPointer: string | number): boolean {
	if (peerItemChange.newItem === undefined) {
		return false
	} else {
		if ([TableRelationshipType.ONE_TO_ONE, TableRelationshipType.ONE_TO_MANY].includes(relationship.type)) {
			return peerItemChange.newItem[relationship.peerPointerAttributeName] === itemKeyPointer
		} else {
			return peerItemChange.newItem[relationship.peerPointerAttributeName].includes(itemKeyPointer)
		}
	}
}

export function shallowCloneObjectAndDirectArrays<T extends Record<string, any>>(obj: T): T {
	return {
		...(Object.fromEntries(Object.entries(obj).map(entry => Array.isArray(entry) ? [...entry] : entry)))
	} as T
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