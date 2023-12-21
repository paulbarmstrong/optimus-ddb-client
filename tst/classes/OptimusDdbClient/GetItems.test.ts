import { PutCommand } from "@aws-sdk/lib-dynamodb"
import { prepDdbTest } from "../../test-utilities/DynamoDb"
import { Connection, MyError, Resource, connectionsTable, resourcesTable } from "../../test-utilities/Constants"
import { ItemNotFoundError } from "../../../src"

test("none of requested items exist", async () => {
	const [optimus, dynamoDBDocumentClient] = await prepDdbTest([resourcesTable], [])
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "abcc", status: "available", updatedAt: 1702172261600, version: 0 }
	}))
	await expect(optimus.getItems({
		table: resourcesTable,
		keys: [{ id: "abcd" }, { id: "abce" }]
	})).rejects.toThrow(ItemNotFoundError)
})

describe("one of requested item doesn't exist", () => {
	test("no itemNotFoundErrorOverride", async () => {
		const [optimus, dynamoDBDocumentClient] = await prepDdbTest([resourcesTable], [])
		await dynamoDBDocumentClient.send(new PutCommand({
			TableName: "Resources",
			Item: { id: "abcd", status: "available", updatedAt: 1702172261600, version: 0 }
		}))
		await expect(optimus.getItems({
			table: resourcesTable,
			keys: [{ id: "abcd" }, { id: "abce" }]
		})).rejects.toThrow(new ItemNotFoundError({ itemKeys: [{ id: "abce" }] }))
	})

	test("itemNotFoundErrorOverride overridden to MyError", async () => {
		const [optimus, dynamoDBDocumentClient] = await prepDdbTest([resourcesTable], [])
		await dynamoDBDocumentClient.send(new PutCommand({
			TableName: "Resources",
			Item: { id: "abcd", status: "available", updatedAt: 1702172261600, version: 0 }
		}))
		await expect(optimus.getItems({
			table: resourcesTable,
			keys: [{ id: "abcd" }, { id: "abce" }],
			itemNotFoundErrorOverride: _ => new MyError()
		})).rejects.toThrow(new MyError)
	})

	test("itemNotFoundErrorOverride overridden to undefined", async () => {
		const [optimus, dynamoDBDocumentClient] = await prepDdbTest([resourcesTable], [])
		await dynamoDBDocumentClient.send(new PutCommand({
			TableName: "Resources",
			Item: { id: "abcd", status: "available", updatedAt: 1702172261600, version: 0 }
		}))
		const resources: Array<Resource> = await optimus.getItems({
			table: resourcesTable,
			keys: [{ id: "abcd" }, { id: "abce" }],
			itemNotFoundErrorOverride: _ => undefined
		})
		expect(resources).toStrictEqual([{ id: "abcd", status: "available", updatedAt: 1702172261600 }])
	})
})

describe("all requested items exist", () => {
	test("table without sort key", async () => {
		const [optimus, dynamoDBDocumentClient] = await prepDdbTest([resourcesTable], [])
		await dynamoDBDocumentClient.send(new PutCommand({
			TableName: "Resources",
			Item: { id: "abcd", status: "available", updatedAt: 1702172261600, version: 0 }
		}))
		await dynamoDBDocumentClient.send(new PutCommand({
			TableName: "Resources",
			Item: { id: "abce", status: "available", updatedAt: 1702172261655, version: 0 }
		}))
		const resources: Array<Resource> = await optimus.getItems({
			table: resourcesTable,
			keys: [{ id: "abcd" }, { id: "abce" }]
		})
		expect(resources).toStrictEqual([
			{ id: "abcd", status: "available", updatedAt: 1702172261600 },
			{ id: "abce", status: "available", updatedAt: 1702172261655 }
		])
	})
	test("table with sort key", async () => {
		const [optimus, dynamoDBDocumentClient] = await prepDdbTest([connectionsTable], [])
		await dynamoDBDocumentClient.send(new PutCommand({
			TableName: "Connections",
			Item: { id: "4567", resourceId: "abbb", updatedAt: 1702186485444, version: 0}
		}))
		const connections: Array<Connection> = await optimus.getItems({
			table: connectionsTable,
			keys: [{ id: "4567", resourceId: "abbb" }]
		})
		expect(connections).toStrictEqual([
			{ id: "4567", resourceId: "abbb", updatedAt: 1702186485444 }
		])
	})
})