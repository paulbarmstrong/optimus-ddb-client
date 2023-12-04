import { ShapeToType, s } from "shape-tape"
import { OptimusDdbClient, Table } from "../src"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"

const dynamoDBClient = new DynamoDBClient()

const resourceShape = s.dictionary({
	id: s.string(),
	status: s.union([s.literal("available"), s.literal("deleted")]),
	updatedAt: s.integer()
})
type Resource = ShapeToType<typeof resourceShape>
const resourcesTable = new Table({
	tableName: "Resources",
	itemShape: resourceShape,
	partitionKey: "id"
})

const connectionShape = s.dictionary({
	id: s.string(),
	resourceId: s.string(),
	updatedAt: s.integer()
})
type Connection = ShapeToType<typeof connectionShape>
const connectionsTable = new Table({
	tableName: "Connections",
	itemShape: connectionShape,
	partitionKey: "id",
	sortKey: "resourceId"
})

describe("types", () => {
	describe("getItem", () => {
		test("table with just partition key", () => {
			const optimus = new OptimusDdbClient({ dynamoDbClient: dynamoDBClient })
			const promise: Promise<Resource> = optimus.getItem({
				table: resourcesTable,
				key: { id: "1234" }
			})
			promise.catch(() => undefined)
		})
		test("using itemNotFoundErrorOverride to convert to undefined", () => {
			const optimus = new OptimusDdbClient({ dynamoDbClient: dynamoDBClient })
			const promise: Promise<Resource | undefined> = optimus.getItem({
				table: resourcesTable,
				key: { id: "1234" },
				itemNotFoundErrorOverride: e => undefined
			})
			promise.catch(() => undefined)
		})
		test("using itemNotFoundErrorOverride to convert to MyError", () => {
			class MyError extends Error {}
			const optimus = new OptimusDdbClient({ dynamoDbClient: dynamoDBClient })
			const promise: Promise<Resource> = optimus.getItem({
				table: resourcesTable,
				key: { id: "1234" },
				itemNotFoundErrorOverride: e => new MyError(e.message)
			})
			promise.catch(() => undefined)
		})
	})
	describe("getItems", () => {
		test("table with just partition key", () => {
			const optimus = new OptimusDdbClient({ dynamoDbClient: dynamoDBClient })
			const promise: Promise<Array<Resource>> = optimus.getItems({
				table: resourcesTable,
				keys: [{
					id: "1234"
				}]
			})
			promise.catch(() => undefined)
		})
		test("table with partition key and sort key", () => {
			const optimus = new OptimusDdbClient({ dynamoDbClient: dynamoDBClient })
			const promise: Promise<Array<Connection>> = optimus.getItems({
				table: connectionsTable,
				keys: [{
					id: "5678",
					resourceId: "1234"
				}]
			})
			promise.catch(() => undefined)
		})
	})
})