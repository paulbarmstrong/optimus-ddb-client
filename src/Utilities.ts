import { OPTIMUS_OPERATORS } from "./Constants"
import { ExpressionBuilder } from "./classes/ExpressionBuilder"
import { ConditionCondition, FilterCondition, InvalidResumeKeyError, PartitionKeyCondition, SortKeyCondition, MergeUnion } from "./Types"
import { ObjectShape, Shape, ShapeToType, UnionShape, s, validateDataShape }  from "shape-tape"
import { Table } from "./classes/Table"
import { Gsi } from "./classes/Gsi"

export function plurality(num: number) {
	return num === 1 ? "" : "s"
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
