import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb"
import { Connection, Resource, connectionsTable, resourcesTable } from "../../test-utilities/Constants"
import { prepDdbTest } from "../../test-utilities/DynamoDb"
import { OptimisticLockError } from "../../../src"

test("create, update, then delete", async () => {
	const [optimus, ddbDocumentClient] = await prepDdbTest([connectionsTable], [])
	const connection: Connection = optimus.draftItem({
		table: connectionsTable, 
		item: { id: "1234", resourceId: "5777", updatedAt: 1702172261600, ttl: 1702172291600 }
	})
	await optimus.commitItems({ items: [connection] })
	const getItemRes0 = await ddbDocumentClient.send(new GetCommand({
		TableName: "Connections",
		Key: { id: "1234", resourceId: "5777" },
		ConsistentRead: true
	}))
	expect(getItemRes0.Item).toStrictEqual({
		id: "1234",
		resourceId: "5777",
		updatedAt: 1702172261600,
		ttl: 1702172291600,
		version: 0
	})
	connection.ttl = 1702172269600
	await optimus.commitItems({ items: [connection] })
	const getItemRes1 = await ddbDocumentClient.send(new GetCommand({
		TableName: "Connections",
		Key: { id: "1234", resourceId: "5777" },
		ConsistentRead: true
	}))
	expect(getItemRes1.Item).toStrictEqual({
		id: "1234",
		resourceId: "5777",
		updatedAt: 1702172261600,
		ttl: 1702172269600,
		version: 1
	})
	optimus.markItemForDeletion({ item: connection })
	await optimus.commitItems({ items: [connection] })
	const getItemRes2 = await ddbDocumentClient.send(new GetCommand({
		TableName: "Connections",
		Key: { id: "1234", resourceId: "5777" },
		ConsistentRead: true
	}))
	expect(getItemRes2.Item).toStrictEqual(undefined)
})

test("update existing item", async () => {
	const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable], [])
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 }
	}))
	const resource: Resource = await optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })
	resource.status = "deleted"
	resource.updatedAt = 1702172271700
	await optimus.commitItems({ items: [resource] })
	const getItemRes = await ddbDocumentClient.send(new GetCommand({
		TableName: "Resources",
		Key: { id: "bbbb" },
		ConsistentRead: true
	}))
	expect(getItemRes.Item).toStrictEqual({ id: "bbbb", status: "deleted", updatedAt: 1702172271700, version: 11 })
})

test("remove attribute", async () => {
	const [optimus, ddbDocumentClient] = await prepDdbTest([connectionsTable], [])
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Connections",
		Item: { id: "5555", resourceId: "5777", updatedAt: 1702172261600, ttl: 1702172291600, version: 0 }
	}))
	const connection: Connection = await optimus.getItem({ table: connectionsTable, key: { id: "5555", resourceId: "5777" } })
	connection.ttl = undefined
	await optimus.commitItems({ items: [connection] })
	const getItemRes = await ddbDocumentClient.send(new GetCommand({
		TableName: "Connections",
		Key: { id: "5555", resourceId: "5777" },
		ConsistentRead: true
	}))
	expect(getItemRes.Item).toStrictEqual({ id: "5555", resourceId: "5777", updatedAt: 1702172261600, version: 1 })
})

test("delete item", async () => {
	const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable], [])
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 }
	}))
	const resource: Resource = await optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })
	optimus.markItemForDeletion({ item: resource })
	await optimus.commitItems({ items: [resource] })
	const getItemRes = await ddbDocumentClient.send(new GetCommand({
		TableName: "Resources",
		Key: { id: "bbbb" },
		ConsistentRead: true
	}))
	expect(getItemRes.Item).toStrictEqual(undefined)
})

test("create, update, and delete at the same time across tables", async () => {
	const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable, connectionsTable], [])
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 }
	}))
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Connections",
		Item: { id: "cccc", resourceId: "0000", updatedAt: 1702172271600, version: 4 }
	}))
	const aaaa: Resource = optimus.draftItem({
		table: resourcesTable,
		item: { id: "aaaa", status: "available", updatedAt: 1702172267700 }
	})
	const bbbb: Resource = await optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })
	const cccc: Connection = await optimus.getItem({ table: connectionsTable, key: { id: "cccc", resourceId: "0000" } })
	bbbb.status = "deleted"
	optimus.markItemForDeletion({ item: cccc })
	await optimus.commitItems({ items: [aaaa, bbbb, cccc] })

	const items = await Promise.all([
		(await ddbDocumentClient.send(new GetCommand({
			TableName: "Resources",
			Key: { id: "aaaa" },
			ConsistentRead: true
		}))).Item,
		(await ddbDocumentClient.send(new GetCommand({
			TableName: "Resources",
			Key: { id: "bbbb" },
			ConsistentRead: true
		}))).Item,
		(await ddbDocumentClient.send(new GetCommand({
			TableName: "Connections",
			Key: { id: "cccc", resourceId: "0000" },
			ConsistentRead: true
		}))).Item
	])
	expect(items).toStrictEqual([
		{ id: "aaaa", status: "available", updatedAt: 1702172267700, version: 0 },
		{ id: "bbbb", status: "deleted", updatedAt: 1702172261700, version: 11 },
		undefined
	])
})

test("create when item already exists", async () => {
	const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable], [])
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 }
	}))
	const resource = optimus.draftItem({
		table: resourcesTable,
		item: { id: "bbbb", status: "available", updatedAt: 1702172261700 },
	})
	await expect(optimus.commitItems({ items: [resource] })).rejects.toThrow(OptimisticLockError)
})

test("update when item's version has changed", async () => {
	const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable], [])
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 }
	}))
	const resource = await optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })
	resource.status = "deleted"
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 11 }
	}))
	await expect(optimus.commitItems({ items: [resource] })).rejects.toThrow(OptimisticLockError)
})

test("update with no changes", async () => {
	const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable], [])
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 }
	}))
	const resource = await optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })
	await optimus.commitItems({ items: [resource] })
	const getItemRes = await ddbDocumentClient.send(new GetCommand({
		TableName: "Resources",
		Key: { id: "bbbb" },
		ConsistentRead: true
	}))
	expect(getItemRes.Item).toStrictEqual({ id: "bbbb", status: "available", updatedAt: 1702172261700, version: 11 })
})


test("create, update, and delete at the same time across tables except an optimistic lock fails", async () => {
	const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable, connectionsTable], [])
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 }
	}))
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Connections",
		Item: { id: "cccc", resourceId: "0000", updatedAt: 1702172271600, version: 4 }
	}))
	const aaaa: Resource = optimus.draftItem({
		table: resourcesTable,
		item: { id: "aaaa", status: "available", updatedAt: 1702172267700 }
	})
	const bbbb: Resource = await optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })
	const cccc: Connection = await optimus.getItem({ table: connectionsTable, key: { id: "cccc", resourceId: "0000" } })
	bbbb.status = "deleted"
	optimus.markItemForDeletion({ item: cccc })

	await ddbDocumentClient.send(new PutCommand({
		TableName: "Connections",
		Item: { id: "cccc", resourceId: "0000", updatedAt: 1702172271600, version: 6 }
	}))

	await expect(optimus.commitItems({ items: [aaaa, bbbb, cccc] })).rejects.toThrow(OptimisticLockError)

	const items = await Promise.all([
		(await ddbDocumentClient.send(new GetCommand({
			TableName: "Resources",
			Key: { id: "aaaa" },
			ConsistentRead: true
		}))).Item,
		(await ddbDocumentClient.send(new GetCommand({
			TableName: "Resources",
			Key: { id: "bbbb" },
			ConsistentRead: true
		}))).Item,
		(await ddbDocumentClient.send(new GetCommand({
			TableName: "Connections",
			Key: { id: "cccc", resourceId: "0000" },
			ConsistentRead: true
		}))).Item
	])
	expect(items).toStrictEqual([
		undefined,
		{ id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 },
		{ id: "cccc", resourceId: "0000", updatedAt: 1702172271600, version: 6 }
	])
})