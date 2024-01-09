import { OPTIMUS_OPERATORS } from "./Constants"
import { ExpressionBuilder } from "./classes/ExpressionBuilder"
import { ConditionCondition, FilterCondition, InvalidResumeKeyError, PartitionKeyCondition, ShapeObject, SortKeyCondition } from "./Types"
import { Shape, ShapeToType, s, validateDataShape }  from "shape-tape"
import { Table } from "./classes/Table"
import { Gsi } from "./classes/Gsi"

export function getDynamoDbExpression(params: {
	partitionKeyCondition?: PartitionKeyCondition<any,any>,
	sortKeyCondition?: SortKeyCondition<any,any>,
	filterConditions?: Array<FilterCondition<any,any>>,
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
	const filterConditions = params.filterConditions !== undefined ? params.filterConditions : []
	const filterConditionExpression = filterConditions
		.map(condition => getDynamoDbConditionExpressionString(condition, builder))
		.join(" AND ")
	const conditionConditions = params.conditionConditions !== undefined ? params.conditionConditions : []
	const conditionConditionExpression = conditionConditions
		.map(condition => getDynamoDbConditionExpressionString(condition, builder))
		.join(" AND ")
	const attributeNames = builder.attributeNames
	const attributeValues = builder.attributeValues
	return {
		KeyConditionExpression: keyConditions.length > 0 ? keyConditionExpression : undefined,
		FilterExpression: filterConditions.length > 0 ? filterConditionExpression : undefined,
		ConditionExpression: conditionConditions.length > 0 ? conditionConditionExpression : undefined,
		ExpressionAttributeNames: Object.entries(attributeNames).length > 0 ? attributeNames : undefined,
		ExpressionAttributeValues: Object.entries(attributeValues).length > 0 ? attributeValues : undefined,
	}
}

export function getDynamoDbConditionExpressionString<L,R>
		(condition: PartitionKeyCondition<any,any> | SortKeyCondition<any,any> | FilterCondition<any,any>,
		builder: ExpressionBuilder): string {
	if (condition[1] === "exists" || condition[1] === "doesn't exist") {
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
		return [
			builder.addName(condition[0]),
			OPTIMUS_OPERATORS[condition[1]],
			builder.addValue(condition[2])
		].join(" ")
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
		[table.partitionKey]: table.itemShape.propertyShapes[table.partitionKey],
		...(table.sortKey !== undefined ? (
			{ [table.sortKey]: table.itemShape.propertyShapes[table.sortKey] }
		) : (
			{}
		)),
		...(index instanceof Gsi ? (
			{
				[index.partitionKey]: index.table.itemShape.propertyShapes[index.partitionKey],
				...(index.sortKey !== undefined ? (
					{ [index.sortKey]: index.table.itemShape.propertyShapes[index.sortKey] }
				) : (
					{}
				))
			}
		) : (
			{}
		))
	})
}

export function plurality(num: number) {
	return num === 1 ? "" : "s"
}

export function getIndexTable<I extends ShapeObject, P extends keyof I, S extends keyof I>
		(index: Table<I,P,S> | Gsi<I,P,S>): Table<I,P,S> {
	if (index instanceof Table) {
		return index
	} else {
		return index.table
	}
}
