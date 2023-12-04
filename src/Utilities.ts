import { OPTIMUS_OPERATORS } from "./Constants"
import { ExpressionBuilder } from "./classes/ExpressionBuilder"
import { ConditionCondition, FilterCondition, PartitionKeyCondition, SortKeyCondition } from "./Types"

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
	const filterConditions = props.filterConditions ? props.filterConditions : []
	const filterConditionExpression = filterConditions
		.map(condition => getDynamoDbConditionExpressionString(condition, builder))
		.join(" AND ")
	const conditionConditions = props.filterConditions ? props.filterConditions : []
	const conditionConditionExpression = conditionConditions
		.map(condition => getDynamoDbConditionExpressionString(condition, builder))
		.join(" AND ")
	return {
		KeyConditionExpression: keyConditions.length > 0 ? keyConditionExpression : undefined,
		FilterExpression: filterConditions.length > 0 ? filterConditionExpression : undefined,
		ConditionExpression: conditionConditions.length > 0 ? conditionConditionExpression : undefined,
		ExpressionAttributeNames: builder.attributeNames,
		ExpressionAttributeValues: builder.attributeValues
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
		throw new Error(`Unexpected condition ${condition}.`)
	}
}
