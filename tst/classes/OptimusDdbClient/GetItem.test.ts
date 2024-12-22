import { PutCommand } from "@aws-sdk/lib-dynamodb"
import { prepDdbTest } from "../../test-utilities/DynamoDb"
import { Connection, MyError, Resource, connectionsTable, resourcesTable } from "../../test-utilities/Constants"
import { ItemNotFoundError } from "../../../src"
import { ItemValidationError } from "../../../src/Types"

describe("non-existent item", () => {
	test("table without sort key", async () => {
		const [optimus, dynamoDBDocumentClient] = await prepDdbTest([resourcesTable], [])
		await dynamoDBDocumentClient.send(new PutCommand({
			TableName: "Resources",
			Item: { id: "abcc", status: "available", updatedAt: 1702172261600, version: 0 }
		}))
		await expect(optimus.getItem({table: resourcesTable, key: { id: "abcd" } })).rejects.toThrow(ItemNotFoundError)
	})

	test("table with sort key", async () => {
		const [optimus, dynamoDBDocumentClient] = await prepDdbTest([connectionsTable], [])
		await dynamoDBDocumentClient.send(new PutCommand({
			TableName: "Connections",
			Item: { id: "4567", resourceId: "abbb", updatedAt: 1702186485444, version: 0 }
		}))
		await expect(optimus.getItem({table: connectionsTable, key: { id: "4568", resourceId: "abbb" } }))
			.rejects.toThrow(ItemNotFoundError)
		await expect(optimus.getItem({table: connectionsTable, key: { id: "4567", resourceId: "abbc" } }))
			.rejects.toThrow(ItemNotFoundError)
	})

	test("with itemNotFoundErrorOverride as MyError", async () => {
		const [optimus] = await prepDdbTest([resourcesTable], [])
		await expect(optimus.getItem({table: resourcesTable, key: { id: "abcd" }, itemNotFoundErrorOverride: _ => new MyError() }))
			.rejects.toThrow(MyError)
	})

	test("with itemNotFoundErrorOverride as undefined", async () => {
		const [optimus] = await prepDdbTest([resourcesTable], [])
		const resource: Resource | undefined = await optimus.getItem({
			table: resourcesTable,
			key: { id: "abcd" },
			itemNotFoundErrorOverride: _ => undefined
		})
		expect(resource).toBeUndefined
	})
})

describe("existing item", () => {
	test("for table without sort key", async () => {
		const [optimus, dynamoDBDocumentClient] = await prepDdbTest([resourcesTable], [])
		await dynamoDBDocumentClient.send(new PutCommand({
			TableName: "Resources",
			Item: { id: "abcd", status: "available", updatedAt: 1702172261600, version: 0 }
		}))
		const resource: Resource = await optimus.getItem({
			table: resourcesTable,
			key: { id: "abcd" }
		})
		expect(resource).toStrictEqual({ id: "abcd", status: "available", updatedAt: 1702172261600 })
	})

	test("for table with sort key", async () => {
		const [optimus, dynamoDBDocumentClient] = await prepDdbTest([connectionsTable], [])
		await dynamoDBDocumentClient.send(new PutCommand({
			TableName: "Connections",
			Item: { id: "4567", resourceId: "abbb", updatedAt: 1702186485444, version: 0}
		}))
		const resource: Connection = await optimus.getItem({
			table: connectionsTable,
			key: { id: "4567", resourceId: "abbb" }
		})
		expect(resource).toStrictEqual({ id: "4567", resourceId: "abbb", updatedAt: 1702186485444})
	})
})

test("item doesn't match itemSchema", async () => {
	const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable], [])
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, score: 2322, version: 10 }
	}))
	await expect(optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })).rejects.toThrow(ItemValidationError)
})

test("item doesn't have version", async () => {
	const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable], [])
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "available", updatedAt: 1702172261700 }
	}))
	await expect(optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })).rejects.toThrow(Error)
})
