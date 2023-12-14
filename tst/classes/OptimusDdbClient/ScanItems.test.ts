import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"
import { prepDdbTest } from "../../test-utilities/DynamoDb"
import { InvalidNextTokenError, OptimusDdbClient } from "../../../src"
import { MyError, connectionsTable, connectionsTableResourceIdGsi, resourcesTable } from "../../test-utilities/Constants"

let optimus: OptimusDdbClient
let dynamoDBDocumentClient: DynamoDBDocumentClient

beforeAll(async () => {
	const prepRes = await prepDdbTest([resourcesTable, connectionsTable], [connectionsTableResourceIdGsi])
	optimus = prepRes[0]
	dynamoDBDocumentClient = prepRes[1]
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "aaaa", status: "available", updatedAt: 1702185590000, version: 0 }
	}))
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "available", updatedAt: 1702185591111, version: 0 }
	}))
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "cccc", status: "deleted", updatedAt: 1702185592222, version: 0 }
	}))
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Connections",
		Item: { id: "4568", resourceId: "dddd", updatedAt: 1702186485444, version: 0 }
	}))
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Connections",
		Item: { id: "4568", resourceId: "eeee", updatedAt: 1702183489321, version: 0 }
	}))
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Connections",
		Item: { id: "4999", resourceId: "dddd", updatedAt: 1702186465344, version: 0 }
	}))
})

test("unfiltered", async () => {
	const [resources] = await optimus.scanItems({
		index: resourcesTable
	})
	expect(resources).toStrictEqual([
		{ id: "aaaa", status: "available", updatedAt: 1702185590000 },
		{ id: "bbbb", status: "available", updatedAt: 1702185591111 },
		{ id: "cccc", status: "deleted", updatedAt: 1702185592222 }
	])
})

test("=", async () => {
	const [resources] = await optimus.scanItems({
		index: resourcesTable,
		filterConditions: [["status", "=", "available"]]
	})
	expect(resources).toStrictEqual([
		{ id: "aaaa", status: "available", updatedAt: 1702185590000 },
		{ id: "bbbb", status: "available", updatedAt: 1702185591111 }
	])
})

test("!=", async () => {
	for (const neq of ["!=", "<>"]) {
		const [resources] = await optimus.scanItems({
			index: resourcesTable,
			filterConditions: [["status", neq as "!=" | "<>", "available"]]
		})
		expect(resources).toStrictEqual([
			{ id: "cccc", status: "deleted", updatedAt: 1702185592222 }
		])
	}
})

test("<", async () => {
	const [resources] = await optimus.scanItems({
		index: resourcesTable,
		filterConditions: [["updatedAt", "<", 1702185592222]]
	})
	expect(resources).toStrictEqual([
		{ id: "aaaa", status: "available", updatedAt: 1702185590000 },
		{ id: "bbbb", status: "available", updatedAt: 1702185591111 }
	])
})

test(">", async () => {
	const [resources] = await optimus.scanItems({
		index: resourcesTable,
		filterConditions: [["updatedAt", ">", 1702185591111]]
	})
	expect(resources).toStrictEqual([
		{ id: "cccc", status: "deleted", updatedAt: 1702185592222 }
	])
})

test("<=", async () => {
	const [resources] = await optimus.scanItems({
		index: resourcesTable,
		filterConditions: [["updatedAt", "<=", 1702185591111]]
	})
	expect(resources).toStrictEqual([
		{ id: "aaaa", status: "available", updatedAt: 1702185590000 },
		{ id: "bbbb", status: "available", updatedAt: 1702185591111 }
	])
})

test(">=", async () => {
	const [resources] = await optimus.scanItems({
		index: resourcesTable,
		filterConditions: [["updatedAt", ">=", 1702185591111]]
	})
	expect(resources).toStrictEqual([
		{ id: "bbbb", status: "available", updatedAt: 1702185591111 },
		{ id: "cccc", status: "deleted", updatedAt: 1702185592222 }
	])
})

test("begins with", async () => {
	const [resources] = await optimus.scanItems({
		index: resourcesTable,
		filterConditions: [["status", "begins with", "a"]]
	})
	expect(resources).toStrictEqual([
		{ id: "aaaa", status: "available", updatedAt: 1702185590000 },
		{ id: "bbbb", status: "available", updatedAt: 1702185591111 }
	])
})

test("contains", async () => {
	const [resources] = await optimus.scanItems({
		index: resourcesTable,
		filterConditions: [["status", "contains", "lete"]]
	})
	expect(resources).toStrictEqual([
		{ id: "cccc", status: "deleted", updatedAt: 1702185592222 }
	])
})

test("in", async () => {
	const [resources] = await optimus.scanItems({
		index: resourcesTable,
		filterConditions: [["updatedAt", "in", [1702185592222, 1702185590000]]]
	})
	expect(resources).toStrictEqual([
		{ id: "aaaa", status: "available", updatedAt: 1702185590000 },
		{ id: "cccc", status: "deleted", updatedAt: 1702185592222 }
	])
})

test("= and >", async () => {
	const [resources] = await optimus.scanItems({
		index: resourcesTable,
		filterConditions: [
			["status", "=", "available"],
			["updatedAt", ">", 1702185590000]
		]
	})
	expect(resources).toStrictEqual([
		{ id: "bbbb", status: "available", updatedAt: 1702185591111 }
	])
})

test("using primary key attribute", async () => {
	const [resources] = await optimus.scanItems({
		index: resourcesTable,
		filterConditions: [["id", "=", "aaaa"]]
	})
	expect(resources).toStrictEqual([
		{ id: "aaaa", status: "available", updatedAt: 1702185590000 }
	])
})

test("using sort key attribute", async () => {
	const [connections] = await optimus.scanItems({
		index: connectionsTable,
		filterConditions: [["resourceId", "=", "dddd"]]
	})
	expect(connections).toStrictEqual([
		{ id: "4568", resourceId: "dddd", updatedAt: 1702186485444 },
		{ id: "4999", resourceId: "dddd", updatedAt: 1702186465344 }
	])
})

test("in pages", async () => {
	const [resources0, nextToken0] = await optimus.scanItems({
		index: resourcesTable,
		limit: 1
	})
	expect(resources0).toStrictEqual([
		{ id: "aaaa", status: "available", updatedAt: 1702185590000 },
	])
	expect(nextToken0).not.toStrictEqual(undefined)
	const [resources1, nextToken1] = await optimus.scanItems({
		index: resourcesTable,
		limit: 1,
		nextToken: nextToken0
	})
	expect(resources1).toStrictEqual([
		{ id: "bbbb", status: "available", updatedAt: 1702185591111 }
	])
	expect(nextToken1).not.toStrictEqual(undefined)
	const [resources2, nextToken2] = await optimus.scanItems({
		index: resourcesTable,
		limit: 1,
		nextToken: nextToken1
	})
	expect(resources2).toStrictEqual([
		{ id: "cccc", status: "deleted", updatedAt: 1702185592222 }
	])
	expect(nextToken2).not.toStrictEqual(undefined)
})

test("invalid nextToken", async () => {
	await expect(optimus.scanItems({
		index: resourcesTable,
		nextToken: "uihdwaulidnw"
	})).rejects.toThrow(InvalidNextTokenError)
})

test("invalid nextToken with invalidNextTokenErrorOverride", async () => {
	await expect(optimus.scanItems({
		index: resourcesTable,
		nextToken: "uihdwaulidnw",
		invalidNextTokenErrorOverride: _ => new MyError()
	})).rejects.toThrow(MyError)
})

describe("from a gsi", () => {
	test("=", async () => {
		const [connections, nextToken] = await optimus.scanItems({
			index: connectionsTableResourceIdGsi,
			filterConditions: [["updatedAt", "=", 1702186485444]]
		})
		expect(connections).toStrictEqual([
			{ id: "4568", resourceId: "dddd", updatedAt: 1702186485444 }
		])
		expect(nextToken).toBeUndefined
	})
	
	test("in pages", async () => {
		const [connections0, nextToken0] = await optimus.queryItems({
			index: connectionsTableResourceIdGsi,
			partitionKeyCondition: ["resourceId", "=", "dddd"],
			limit: 1
		})
		expect(connections0).toStrictEqual([
			{ id: "4568", resourceId: "dddd", updatedAt: 1702186485444 }
		])
		expect(nextToken0).toBeDefined
		const [connections1, nextToken1] = await optimus.queryItems({
			index: connectionsTableResourceIdGsi,
			partitionKeyCondition: ["resourceId", "=", "dddd"],
			limit: 1,
			nextToken: nextToken0
		})
		expect(connections1).toStrictEqual([
			{ id: "4999", resourceId: "dddd", updatedAt: 1702186465344 }
		])
		expect(nextToken1).toBeUndefined
	})
})

