import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"
import { prepDdbTest } from "../../test-utilities/DynamoDb"
import { connectionsTable, connectionsTableResourceIdGsi, resourcesTable } from "../../test-utilities/Constants"
import { OptimusDdbClient } from "../../../src"

let optimus: OptimusDdbClient
let dynamoDBDocumentClient: DynamoDBDocumentClient

beforeAll(async () => {
	const prepRes = await prepDdbTest([resourcesTable, connectionsTable], [connectionsTableResourceIdGsi])
	optimus = prepRes[0]
	dynamoDBDocumentClient = prepRes[1]
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "aaaa", status: "available", updatedAt: 1702185430122, version: 0 }
	}))
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "deleted", updatedAt: 1702185593784, version: 0 }
	}))
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Connections",
		Item: { id: "4568", resourceId: "aaaa", updatedAt: 1702186485444, version: 0 }
	}))
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Connections",
		Item: { id: "4568", resourceId: "bbbb", updatedAt: 1702183489321, version: 0 }
	}))
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Connections",
		Item: { id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312, version: 0 }
	}))
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Connections",
		Item: { id: "5555", resourceId: "cccc", updatedAt: 1702186486734, version: 0 }
	}))
})

describe("table with partition key only", () => {
	test("no results", async () => {
		const [resources, nextToken] = await optimus.queryItems({
			index: resourcesTable,
			partitionKeyCondition: ["id", "=", "4567"]
		})
		expect(resources).toStrictEqual([])
		expect(nextToken).toStrictEqual(undefined)
	})

	test("with a result", async () => {
		const [resources] = await optimus.queryItems({
			index: resourcesTable,
			partitionKeyCondition: ["id", "=", "aaaa"]
		})
		expect(resources).toStrictEqual([{ id: "aaaa", status: "available", updatedAt: 1702185430122 }])
	})

	test("no result due to filter condition", async () => {
		const [resources] = await optimus.queryItems({
			index: resourcesTable,
			partitionKeyCondition: ["id", "=", "aaaa"],
			filterConditions: [["status", "=", "deleted"]]
		})
		expect(resources).toStrictEqual([])
	})

	test("filter condition with result", async () => {
		const [resources, nextToken] = await optimus.queryItems({
			index: resourcesTable,
			partitionKeyCondition: ["id", "=", "aaaa"],
			filterConditions: [["status", "<>", "deleted"]]
		})
		expect(resources).toStrictEqual([{ id: "aaaa", status: "available", updatedAt: 1702185430122 }])
		expect(nextToken).toStrictEqual(undefined)
	})
})

describe("table with sort key", () => {
	describe("query by partition key only", () => {
		test("no results", async () => {
			const [connections, nextToken] = await optimus.queryItems({
				index: connectionsTable,
				partitionKeyCondition: ["id", "=", "4567"]
			})
			expect(connections).toStrictEqual([])
			expect(nextToken).toStrictEqual(undefined)
		})

		test("one result", async () => {
			const [connections] = await optimus.queryItems({
				index: connectionsTable,
				partitionKeyCondition: ["id", "=", "5555"]
			})
			expect(connections).toStrictEqual([{ id: "5555", resourceId: "cccc", updatedAt: 1702186486734 }])
		})

		test("multiple results", async () => {
			const [connections, nextToken] = await optimus.queryItems({
				index: connectionsTable,
				partitionKeyCondition: ["id", "=", "4568"]
			})
			expect(connections).toStrictEqual([
				{ id: "4568", resourceId: "aaaa", updatedAt: 1702186485444 },
				{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 },
				{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
			])
			expect(nextToken).toStrictEqual(undefined)
		})
	})
	describe("= sort key condition", () => {
		test("no result", async () => {
			const [connections] = await optimus.queryItems({
				index: connectionsTable,
				partitionKeyCondition: ["id", "=", "5555"],
				sortKeyCondition: ["resourceId", "=", "bbbb"]
			})
			expect(connections).toStrictEqual([])
		})

		test("with result", async () => {
			const [connections] = await optimus.queryItems({
				index: connectionsTable,
				partitionKeyCondition: ["id", "=", "4568"],
				sortKeyCondition: ["resourceId", "=", "cccc"]
			})
			expect(connections).toStrictEqual([{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }])
		})
	})
	test("> sort key condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			sortKeyCondition: ["resourceId", ">", "bbbb"]
		})
		expect(connections).toStrictEqual([{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }])
	})
	test("< sort key condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			sortKeyCondition: ["resourceId", "<", "bbbb"]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "aaaa", updatedAt: 1702186485444 }
		])
	})

	test("<= sort key condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			sortKeyCondition: ["resourceId", "<=", "bbbb"]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "aaaa", updatedAt: 1702186485444 },
			{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 }
		])
	})

	test(">= sort key condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			sortKeyCondition: ["resourceId", ">=", "bbbb"]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 },
			{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
		])
	})

	test("begins with sort key condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			sortKeyCondition: ["resourceId", "begins with", "c"]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
		])
	})

	describe("between sort key condition", () => {
		test("no results", async () => {
			const [connections] = await optimus.queryItems({
				index: connectionsTable,
				partitionKeyCondition: ["id", "=", "4568"],
				sortKeyCondition: ["resourceId", "between", "0000", "and", "1111"]
			})
			expect(connections).toStrictEqual([])
		})
		test("one result", async () => {
			const [connections] = await optimus.queryItems({
				index: connectionsTable,
				partitionKeyCondition: ["id", "=", "4568"],
				sortKeyCondition: ["resourceId", "between", "bbbb", "and", "beee"]
			})
			expect(connections).toStrictEqual([
				{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 }
			])
		})
		test("multiple results", async () => {
			const [connections] = await optimus.queryItems({
				index: connectionsTable,
				partitionKeyCondition: ["id", "=", "4568"],
				sortKeyCondition: ["resourceId", "between", "0000", "and", "bbbb"]
			})
			expect(connections).toStrictEqual([
				{ id: "4568", resourceId: "aaaa", updatedAt: 1702186485444 },
				{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 }
			])
		})
	})

	test("= filter condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			sortKeyCondition: ["resourceId", ">", "aaaa"],
			filterConditions: [["updatedAt", "=", 1702183489321]]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 }
		])
	})

	test("!= filter condition", async () => {
		for (const neq of ["!=", "<>"]) {
			const [connections] = await optimus.queryItems({
				index: connectionsTable,
				partitionKeyCondition: ["id", "=", "4568"],
				sortKeyCondition: ["resourceId", ">", "aaaa"],
				filterConditions: [["updatedAt", neq as "!=" | "<>", 1702183489321]]
			})
			expect(connections).toStrictEqual([
				{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
			])
		}
	})

	test("< filter condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			sortKeyCondition: ["resourceId", ">", "aaaa"],
			filterConditions: [["updatedAt", "<", 1702183489321]]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
		])
	})

	test("> filter condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			sortKeyCondition: ["resourceId", ">", "aaaa"],
			filterConditions: [["updatedAt", ">", 1702183485312]]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 }
		])
	})

	test("<= filter condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			sortKeyCondition: ["resourceId", ">", "aaaa"],
			filterConditions: [["updatedAt", "<=", 1702183489321]]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 },
			{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
		])
	})

	test(">= filter condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			sortKeyCondition: ["resourceId", "<", "cccc"],
			filterConditions: [["updatedAt", ">=", 1702183489321]]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "aaaa", updatedAt: 1702186485444 },
			{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 }
		])
	})

	test("between filter condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			filterConditions: [["updatedAt", "between", 1702183489321, "and", 1702183489321]]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 }
		])
	})

	test("exists filter condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			filterConditions: [["ttl", "exists"]]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
		])
	})
	
	test("exists filter condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			filterConditions: [["ttl", "doesn't exist"]]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "aaaa", updatedAt: 1702186485444 },
			{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 }
		])
	})

	test("exists filter condition", async () => {
		const [connections] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			filterConditions: [["updatedAt", "in", [1702183489321, 1702183485312]]]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 },
			{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
		])
	})

	test("in pages", async () => {
		const [connections0, nextToken0] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			limit: 2
		})
		expect(connections0).toStrictEqual([
			{ id: "4568", resourceId: "aaaa", updatedAt: 1702186485444 },
			{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 }
		])
		expect(nextToken0).toBeDefined
		const [connections1, nextToken1] = await optimus.queryItems({
			index: connectionsTable,
			partitionKeyCondition: ["id", "=", "4568"],
			limit: 2,
			nextToken: nextToken0
		})
		expect(connections1).toStrictEqual([
			{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
		])
		expect(nextToken1).toBeUndefined
	})
})

test("for a GSI", async () => {
	const [connections] = await optimus.queryItems({
		index: connectionsTableResourceIdGsi,
		partitionKeyCondition: ["resourceId", "=", "cccc"]
	})
	expect(connections).toStrictEqual([
		{ id: "5555", resourceId: "cccc", updatedAt: 1702186486734 },
		{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 },
	])
})