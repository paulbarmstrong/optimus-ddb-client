import { OPTIMUS_OPERATORS } from "./Constants"
import { ExpressionBuilder } from "./classes/ExpressionBuilder"
import { ConditionCondition, FilterCondition, InvalidNextTokenError, PartitionKeyCondition, SortKeyCondition } from "./Types"
import { Shape, ShapeToType, s as sh, validateObjectShape }  from "shape-tape"
import { Paginator, QueryCommandInput, QueryCommandOutput, ScanCommandInput, ScanCommandOutput } from "@aws-sdk/lib-dynamodb"
import { Table } from "./classes/Table"
import { Gsi } from "./classes/Gsi"

export function getDynamoDbExpression(props: {
	partitionKeyCondition?: PartitionKeyCondition<any,any>,
	sortKeyCondition?: SortKeyCondition<any,any>,
	filterConditions?: Array<FilterCondition<any,any>>,
	conditionConditions?: Array<ConditionCondition<any,any>>
}) {
	const builder: ExpressionBuilder = new ExpressionBuilder()
	const keyConditions = [
		...(props.partitionKeyCondition ? [props.partitionKeyCondition] : []),
		...(props.sortKeyCondition ? [props.sortKeyCondition] : [])
	]
	const keyConditionExpression = keyConditions
		.map(condition => getDynamoDbConditionExpressionString(condition, builder))
		.join(" AND ")
	const filterConditions = props.filterConditions !== undefined ? props.filterConditions : []
	const filterConditionExpression = filterConditions
		.map(condition => getDynamoDbConditionExpressionString(condition, builder))
		.join(" AND ")
	const conditionConditions = props.conditionConditions !== undefined ? props.conditionConditions : []
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

export function encodeNextToken<T extends Record<string, any>>(lastEvaluatedKey: T | undefined): string | undefined {
	if (lastEvaluatedKey === undefined) return undefined
	return Buffer.from(JSON.stringify(lastEvaluatedKey), "utf-8").toString("base64")
}

export function decodeNextToken<T extends Shape>(nextToken: string | undefined, keyShape: T,
		invalidNextTokenErrorOverride?: (e: InvalidNextTokenError) => Error)
		: ShapeToType<typeof keyShape> | undefined {
	if (nextToken === undefined) return undefined
	try {
		return validateObjectShape({
			object: JSON.parse(Buffer.from(nextToken, "base64").toString()),
			shape: keyShape
		})
	} catch (error) {
		if (invalidNextTokenErrorOverride !== undefined) {
			throw invalidNextTokenErrorOverride(new InvalidNextTokenError())
		} else {
			throw new InvalidNextTokenError()
		}
	}
}

export function getLastEvaluatedKeyShape(index: Table<any,any,any> | Gsi<any,any,any>): Shape {
	return sh.dictionary({
		[index.table.partitionKey]: index.table.itemShape.dictionary[index.table.partitionKey],
		...(index.table.sortKey !== undefined ? (
			{ [index.table.sortKey]: index.table.itemShape.dictionary[index.table.sortKey] }
		) : (
			{}
		)),
		...(index instanceof Gsi ? (
			{
				[index.partitionKey]: index.table.itemShape.dictionary[index.partitionKey],
				...(index.sortKey !== undefined ? (
					{ [index.sortKey]: index.table.itemShape.dictionary[index.sortKey] }
				) : (
					{}
				))
			}
		) : (
			{}
		))
	})
}

export async function getItemsFromPaginator(paginator: Paginator<QueryCommandOutput | ScanCommandOutput>, limit: number | undefined)
		: Promise<[Array<Record<string, any>>, Record<string, any> | undefined]> {
	const items: Array<Record<string, any>> = []
	for await (const page of paginator) {
		items.push(...page.Items!)
		if (limit !== undefined && items.length >= limit) {
			return [items.slice(0, limit), page.LastEvaluatedKey]
		}
	}
	return [items, undefined]
}

export async function getItemsPages(props: {
	params: QueryCommandInput | ScanCommandInput,
	get: (input: QueryCommandInput | ScanCommandInput) => Promise<QueryCommandOutput | ScanCommandOutput>,
	limit: number | undefined,
	lastEvaluatedKey: Record<string, any> | undefined
})
	: Promise<[Array<Record<string, any>>, Record<string, any> | undefined]> {
	const items: Array<Record<string, any>> = []
	let lastEvaluatedKey: Record<string, any> | undefined = props.lastEvaluatedKey
	do {
		const res = await props.get({
			...props.params,
			ExclusiveStartKey: lastEvaluatedKey,
			Limit: props.limit !== undefined ? props.limit - items.length : undefined
		})
		items.push(...res.Items!)
		lastEvaluatedKey = res.LastEvaluatedKey
	} while (lastEvaluatedKey !== undefined && !(props.limit && items.length === props.limit))
	return [items, lastEvaluatedKey]
}

export function plurality(num: number) {
	return num === 1 ? "" : "s"
}
