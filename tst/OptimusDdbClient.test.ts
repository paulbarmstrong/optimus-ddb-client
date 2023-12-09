import { ShapeToType, s } from "shape-tape"
import { OptimusDdbClient, Table } from "../src"

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
			const optimus = new OptimusDdbClient()
			const promise: Promise<Resource> = optimus.getItem({
				table: resourcesTable,
				key: { id: "1234" }
			})
			promise.catch(() => undefined)
		})
		test("using itemNotFoundErrorOverride to convert to undefined", () => {
			const optimus = new OptimusDdbClient()
			const promise: Promise<Resource | undefined> = optimus.getItem({
				table: resourcesTable,
				key: { id: "1234" },
				itemNotFoundErrorOverride: e => undefined
			})
			promise.catch(() => undefined)
		})
		test("using itemNotFoundErrorOverride to convert to MyError", () => {
			class MyError extends Error {}
			const optimus = new OptimusDdbClient()
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
			const optimus = new OptimusDdbClient()
			const promise: Promise<Array<Resource>> = optimus.getItems({
				table: resourcesTable,
				keys: [{
					id: "1234"
				}]
			})
			promise.catch(() => undefined)
		})
		test("using itemNotFoundErrorOverride", () => {
			class MyError extends Error {}
			const optimus = new OptimusDdbClient()
			const promise: Promise<Array<Resource>> = optimus.getItems({
				table: resourcesTable,
				keys: [{
					id: "1234"
				}],
				itemNotFoundErrorOverride: e => new MyError(e.message)
			})
			promise.catch(() => undefined)
		})
		test("table with partition key and sort key", () => {
			const optimus = new OptimusDdbClient()
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
	describe("queryItems", () => {
		test("index with just partition key and no limit", () => {
			const optimus = new OptimusDdbClient()
			const promise: Promise<[Array<Resource>, undefined]> = optimus.queryItems({
				index: resourcesTable,
				partitionKeyCondition: ["id", "=", "100"]
			})
			promise.catch(() => undefined)
		})
		test("index with just partition key and a limit", () => {
			const optimus = new OptimusDdbClient()
			const promise: Promise<[Array<Resource>, string | undefined]> = optimus.queryItems({
				index: resourcesTable,
				partitionKeyCondition: ["id", "=", "100"],
				limit: 10
			})
			promise.catch(() => undefined)
		})
	})
	describe("scanItems", () => {
		test("with no limit", () => {
			const optimus = new OptimusDdbClient()
			const promise: Promise<[Array<Resource>, undefined]> = optimus.scanItems({
				index: resourcesTable
			})
			promise.catch(() => undefined)
		})
		test("with a limit", () => {
			const optimus = new OptimusDdbClient()
			const promise: Promise<[Array<Resource>, string | undefined]> = optimus.scanItems({
				index: resourcesTable,
				limit: 10
			})
			promise.catch(() => undefined)
		})
	})
})