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

describe("some items don't exist", () => {
	test("one item missing and no itemNotFoundErrorOverride", async () => {
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

	test("one item missing and itemNotFoundErrorOverride overridden to MyError", async () => {
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

	test("one item missing and itemNotFoundErrorOverride overridden to undefined", async () => {
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
	test("150 items, 2 missing", async () => {
		const [optimus] = await prepDdbTest([resourcesTable], [])
		const testResources = new Array(150).fill(undefined).map((_, index) => optimus.draftItem({
			table: resourcesTable,
			item: {
				id: index.toString(),
				status: "available",
				updatedAt: Date.now()
			}
		})).filter(resource => resource.id !== "27" && resource.id !== "133")
		await optimus.commitItems({ items: testResources.slice(0, 75) })
		await optimus.commitItems({ items: testResources.slice(75, 148) })

		await expect(optimus.getItems({
			table: resourcesTable,
			keys: new Array(150).fill(undefined)
				.map((_, index) => ({ id: index.toString() })),
		})).rejects.toThrow(new ItemNotFoundError({ itemKeys: [{ id: "27" }, { id: "133" }] }))
	})
	test("150 items, 2 missing, itemNotFoundError overridden to undefined", async () => {
		const [optimus] = await prepDdbTest([resourcesTable], [])
		const testResources = new Array(150).fill(undefined).map((_, index) => optimus.draftItem({
			table: resourcesTable,
			item: {
				id: index.toString(),
				status: "available",
				updatedAt: Date.now()
			}
		})).filter(resource => resource.id !== "27" && resource.id !== "133")
		await optimus.commitItems({ items: testResources.slice(0, 75) })
		await optimus.commitItems({ items: testResources.slice(75, 148) })

		const resources = await optimus.getItems({
			table: resourcesTable,
			keys: new Array(150).fill(undefined)
				.map((_, index) => ({ id: index.toString() })),
			itemNotFoundErrorOverride: () => undefined
		})
		expect(resources).toStrictEqual(testResources)
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
	test("150 items", async () => {
		const [optimus] = await prepDdbTest([resourcesTable], [])
		const testResources = new Array(150).fill(undefined).map((_, index) => optimus.draftItem({
			table: resourcesTable,
			item: {
				id: index.toString(),
				status: "available",
				updatedAt: Date.now()
			}
		}))
		await optimus.commitItems({ items: testResources.slice(0, 75) })
		await optimus.commitItems({ items: testResources.slice(75, 150) })

		const resources = await optimus.getItems({
			table: resourcesTable,
			keys: new Array(150).fill(undefined).map((_, index) => ({ id: index.toString() }))
		})
		expect(resources).toStrictEqual(testResources)
	})
})