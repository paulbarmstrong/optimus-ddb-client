import { CreateTableCommand, DeleteTableCommand, DescribeTableCommand, DynamoDBClient, ListTablesCommand, ScalarAttributeType
} from "@aws-sdk/client-dynamodb"
import { Gsi, OptimusDdbClient, Table } from "../../src"
import { LiteralShape, NumberShape, ObjectShape, Shape, StringShape, UnionShape, s } from "shape-tape"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import { DYNAMO_DB_LOCAL_CLIENT_CONFIG } from "./Constants"

export async function prepDdbTest(tables: Array<Table<any,any,any>>, gsis: Array<Gsi<any,any,any>>, gsiProjectionType: "ALL" | "KEYS_ONLY" = "ALL")
		: Promise<[OptimusDdbClient, DynamoDBDocumentClient]> {
	const dynamoDb: DynamoDBClient = new DynamoDBClient(DYNAMO_DB_LOCAL_CLIENT_CONFIG)
	const existingTables: Array<string> = (await dynamoDb.send(new ListTablesCommand({}))).TableNames!
	await Promise.all(existingTables.map(async tableName => {
		await dynamoDb.send(new DeleteTableCommand({ TableName: tableName }))
	}))
	await Promise.all(tables.map(async table => {
		const tableGsis = gsis.filter(gsi => gsi.table.tableName === table.tableName)
		const globalSecondaryIndexes = tableGsis.map(gsi => {
			return {
				IndexName: gsi.indexName,
				Projection: { ProjectionType: gsiProjectionType },
				KeySchema: [
					{ AttributeName: gsi.partitionKey, KeyType: "HASH" as "HASH" },
					...(gsi.sortKey ? [{ AttributeName: gsi.sortKey, KeyType: "RANGE" as "RANGE" }] : [])
				]
			}
		})
		while ((await dynamoDb.send(new ListTablesCommand({}))).TableNames!.length > 0) {}
		const attributeNames = [table.partitionKey, table.sortKey, ...tableGsis.map(gsi => [gsi.partitionKey, gsi.sortKey]).flat()]
			.filter(attributeName => attributeName !== undefined)
		await dynamoDb.send(new CreateTableCommand({
			TableName: table.tableName,
			BillingMode: "PAY_PER_REQUEST",
			AttributeDefinitions: [...new Set(attributeNames)].map(attributeName => ({
				AttributeName: attributeName,
				AttributeType: shapeToDdbAttributeType(getItemShapePropertyValueShape(table, attributeName))
			})),
			KeySchema: [
				{ AttributeName: table.partitionKey, KeyType: "HASH" as "HASH" },
				...(table.sortKey ? [{ AttributeName: table.sortKey, KeyType: "RANGE" as "RANGE" }] : [])
			],
			GlobalSecondaryIndexes: globalSecondaryIndexes.length > 0 ? globalSecondaryIndexes : undefined
		}))
	}))
	let numAvailableTables = 0
	do {
		const tableNames = (await dynamoDb.send(new ListTablesCommand({}))).TableNames
		const tableStatuses = await Promise.all(tableNames!.map(async tableName => {
			return (await dynamoDb.send(new DescribeTableCommand({ TableName: tableName }))).Table!.TableStatus
		}))
		numAvailableTables = tableStatuses.filter(status => status === "ACTIVE").length
	} while (numAvailableTables !== tables.length)

	return [new OptimusDdbClient({ dynamoDbClientConfig: DYNAMO_DB_LOCAL_CLIENT_CONFIG }), DynamoDBDocumentClient.from(dynamoDb)]
}

function shapeToDdbAttributeType(shape: Shape): ScalarAttributeType {
	if (shape instanceof NumberShape) {
		return "N"
	} else {
		return "S"
	}
}

function getItemShapePropertyValueShape(table: Table<any,any,any>, attributeName: string): Shape {
	if (table.itemShape.propertyShapes !== undefined) {
		return table.itemShape.propertyShapes[attributeName]
	} else {
		const specificMembers: Array<Shape> = (table.itemShape.memberShapes as Array<ObjectShape<any>>)
			.filter(member => Object.keys(member.propertyShapes).includes(attributeName))
			.map(member => member.propertyShapes[attributeName])
		return s.union(specificMembers)
	}
}