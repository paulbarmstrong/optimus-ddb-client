import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb"
import { Connection, Resource, connectionsTable, resourceEventsTable, resourcesTable } from "../../test-utilities/Constants"
import { prepDdbTest } from "../../test-utilities/DynamoDb"
import { ItemShapeValidationError, OptimisticLockError, Table } from "../../../src"
import { ShapeToType, s } from "shape-tape"
import { TableRelationshipType, TableRelationshipViolationError } from "../../../src/Types"

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

describe("create when item already exists", () => {
	test("partition-key table", async () => {
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
	test("composite-key table", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([connectionsTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Connections",
			Item: { id: "1111", resourceId: "bbbb", updatedAt: 2819821, version: 0 }
		}))
		const connection = optimus.draftItem({
			table: connectionsTable,
			item: { id: "1111", resourceId: "bbbb", updatedAt: 2819821, ttl: undefined },
		})
		await expect(optimus.commitItems({ items: [connection] })).rejects.toThrow(OptimisticLockError)
	})
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

test("undefined members", async () => {
	const ticketsTable = new Table({
		tableName: "Tickets",
		itemShape: s.object({
			id: s.string(),
			title: s.string(),
			content: s.optional(s.string()),
			comments: s.array(s.object({
				id: s.string(),
				name: s.optional(s.string())
			}))
		}),
		partitionKey: "id"
	})
	const [optimus, ddbDocumentClient] = await prepDdbTest([ticketsTable], [])
	
	const ticket = optimus.draftItem({
		table: ticketsTable,
		item: {
			id: "1234",
			title: "my ticket",
			content: undefined,
			comments: [ { id: "4567", name: undefined } ]
		}
	})

	await optimus.commitItems({ items: [ticket] })

	const ticketItem = (await ddbDocumentClient.send(new GetCommand({
		TableName: "Tickets",
		Key: { id: ticket.id }
	}))).Item
	expect(ticketItem).toStrictEqual({
		id: "1234",
		title: "my ticket",
		comments: [ { id: "4567" } ],
		version: 0
	})
})

test("change that violates the shape", async () => {
	const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable], [])
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 }
	}))
	const resource = await optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })
	resource.status = "starting" as any
	await expect(optimus.commitItems({ items: [resource] })).rejects.toThrow("Parameter \"status\" is invalid.")
})

describe("change item key", () => {
	test("normal case", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Resources",
			Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 }
		}))
		const resource = await optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })

		resource.id = "ffff"
		await optimus.commitItems({ items: [resource] })

		let bbbbItem = (await ddbDocumentClient.send(new GetCommand({
			TableName: "Resources",
			Key: { id: "bbbb" }
		}))).Item
		let ffffItem = (await ddbDocumentClient.send(new GetCommand({
			TableName: "Resources",
			Key: { id: "ffff" }
		}))).Item
		expect(bbbbItem).toBeUndefined()
		expect(ffffItem).toStrictEqual({ id: "ffff", status: "available", updatedAt: 1702172261700, version: 0 })

		resource.status = "deleted"
		await optimus.commitItems({ items: [resource] })

		bbbbItem = (await ddbDocumentClient.send(new GetCommand({
			TableName: "Resources",
			Key: { id: "bbbb" }
		}))).Item
		ffffItem = (await ddbDocumentClient.send(new GetCommand({
			TableName: "Resources",
			Key: { id: "ffff" }
		}))).Item
		expect(bbbbItem).toBeUndefined()
		expect(ffffItem).toStrictEqual({ id: "ffff", status: "deleted", updatedAt: 1702172261700, version: 1 })
	})

	test("item with new key already exists", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Resources",
			Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 },
		}))
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Resources",
			Item: { id: "ffff", status: "deleted", updatedAt: 1702172261700, version: 11 }
		}))

		const resource = await optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })
		resource.id = "ffff"
		await expect(optimus.commitItems({ items: [resource] })).rejects.toThrow(OptimisticLockError)
	})

	test("item was updated in the mean time", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Resources",
			Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 },
		}))
		const resource = await optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })

		await ddbDocumentClient.send(new PutCommand({
			TableName: "Resources",
			Item: { id: "bbbb", status: "deleted", updatedAt: 1702172261700, version: 11 },
		}))

		resource.id = "ffff"
		await expect(optimus.commitItems({ items: [resource] })).rejects.toThrow(OptimisticLockError)
	})
	
	test("commit contains", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Resources",
			Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 },
		}))
		const resource0 = await optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })
		const resource1 = optimus.draftItem({ table: resourcesTable, item: { id: "bbbb", status: "deleted", updatedAt: 1702172261800 } })
		resource0.id = "cccc"

		await optimus.commitItems({ items: [resource0, resource1] })

		expect((await ddbDocumentClient.send(new GetCommand({ TableName: "Resources", Key: { id: "cccc" }, }))).Item)
			.toStrictEqual({ id: "cccc", status: "available", updatedAt: 1702172261700, version: 0 })
		expect((await ddbDocumentClient.send(new GetCommand({ TableName: "Resources", Key: { id: "bbbb" }, }))).Item)
			.toStrictEqual({ id: "bbbb", status: "deleted", updatedAt: 1702172261800, version: 11 })
	})
})

describe("custom version attribute", () => {
	const fruitTable = new Table({
		tableName: "Fruit",
		itemShape: s.object({
			id: s.string(),
			name: s.string(),
			quantity: s.integer()
		}),
		partitionKey: "id",
		versionAttribute: "_version"
	})
	type Fruit = ShapeToType<typeof fruitTable.itemShape>
	test("create, update, then delete", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([fruitTable], [])
		const apple: Fruit = optimus.draftItem({
			table: fruitTable,
			item: { id: "9495", name: "Apple", quantity: 10 }
		})
		await optimus.commitItems({ items: [apple] })
		const getItemRes0 = await ddbDocumentClient.send(new GetCommand({
			TableName: "Fruit",
			Key: { id: "9495" },
			ConsistentRead: true
		}))
		expect(getItemRes0.Item).toStrictEqual({
			id: "9495",
			name: "Apple",
			quantity: 10,
			"_version": 0
		})
		apple.quantity = 9
		await optimus.commitItems({ items: [apple] })
		const getItemRes1 = await ddbDocumentClient.send(new GetCommand({
			TableName: "Fruit",
			Key: { id: "9495" },
			ConsistentRead: true
		}))
		expect(getItemRes1.Item).toStrictEqual({
			id: "9495",
			name: "Apple",
			quantity: 9,
			"_version": 1
		})
		optimus.markItemForDeletion({ item: apple })
		await optimus.commitItems({ items: [apple] })
		const getItemRes2 = await ddbDocumentClient.send(new GetCommand({
			TableName: "Fruit",
			Key: { id: "9495" },
			ConsistentRead: true
		}))
		expect(getItemRes2.Item).toStrictEqual(undefined)
	})
	
	test("update existing item", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([fruitTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Fruit",
			Item: { id: "3001", name: "Banana", quantity: 0, "_version": 13 }
		}))
		const banana: Fruit = await optimus.getItem({ table: fruitTable, key: { id: "3001" } })
		banana.quantity = 5
		await optimus.commitItems({ items: [banana] })
		const getItemRes = await ddbDocumentClient.send(new GetCommand({
			TableName: "Fruit",
			Key: { id: "3001" },
			ConsistentRead: true
		}))
		expect(getItemRes.Item).toStrictEqual({ id: "3001", name: "Banana", quantity: 5, "_version": 14 })
	})
})

describe("table with UnionShape itemShape", () => {
	test("regular creates", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([resourceEventsTable], [])
		const event0 = optimus.draftItem({
			table: resourceEventsTable,
			item: { id: "aaaa", type: "title-change", title: "my document" }
		})
		const event1 = optimus.draftItem({
			table: resourceEventsTable,
			item: { id: "bbbb", type: "new-comment", comment: "hello" }
		})
		await optimus.commitItems({ items: [event0, event1] })
	
		expect((await ddbDocumentClient.send(new GetCommand({
			TableName: "ResourceEvents",
			Key: { id: "aaaa" },
			ConsistentRead: true
		}))).Item).toStrictEqual({ id: "aaaa", type: "title-change", title: "my document", version: 0 })
		expect((await ddbDocumentClient.send(new GetCommand({
			TableName: "ResourceEvents",
			Key: { id: "bbbb" },
			ConsistentRead: true
		}))).Item).toStrictEqual({ id: "bbbb", type: "new-comment", comment: "hello", version: 0 })
	})

	test("regular update", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([resourceEventsTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "ResourceEvents",
			Item: { id: "cccc", type: "title-change", title: "new document", version: 0 }
		}))

		const event = await optimus.getItem({
			table: resourceEventsTable,
			key: { id: "cccc" }
		})
		expect(event).toStrictEqual({ id: "cccc", type: "title-change", title: "new document" })
		if (event.type === "title-change") {
			event.title = "new document (1)"
		}
		await optimus.commitItems({ items: [event] })
		expect((await ddbDocumentClient.send(new GetCommand({
			TableName: "ResourceEvents",
			Key: { id: "cccc" },
			ConsistentRead: true
		}))).Item).toStrictEqual({ id: "cccc", type: "title-change", title: "new document (1)", version: 1 })
	})

	test("mixing union members", async () => {
		const [optimus] = await prepDdbTest([resourceEventsTable], [])
		const event = optimus.draftItem({
			table: resourceEventsTable,
			item: { id: "dddd", type: "new-comment", comment: "hello" }
		})
		;(event as any).title = "hello"
		await expect(optimus.commitItems({ items: [event] })).rejects.toThrow(ItemShapeValidationError)
	})
})

test("item tries to get committed with extra attribute", async () => {
	const [optimus, ddbDocumentClient] = await prepDdbTest([resourcesTable], [])
	await ddbDocumentClient.send(new PutCommand({
		TableName: "Resources",
		Item: { id: "bbbb", status: "available", updatedAt: 1702172261700, version: 10 }
	}))
	const resource: Resource = await optimus.getItem({ table: resourcesTable, key: { id: "bbbb" } })
	resource.status = "deleted"
	resource.updatedAt = 1702172271700
	;(resource as any).telemetryCode = "49838943"
	await expect(optimus.commitItems({ items: [resource] })).rejects.toThrow(ItemShapeValidationError)
})

describe("regular ONE_TO_ONE relationship", () => {
	const aliasesTable = new Table({
		tableName: "Aliases",
		itemShape: s.object({
			id: s.string(),
			firstLetter: s.string(),
			userId: s.string()
		}),
		partitionKey: "id"
	})
	const usersTable = new Table({
		tableName: "Users",
		itemShape: s.object({
			id: s.string(),
			alias: s.string()
		}),
		partitionKey: "id"
	})
	usersTable.addRelationship({
		type: TableRelationshipType.ONE_TO_ONE,
		pointerAttributeName: "alias",
		peerTable: aliasesTable,
		peerPointerAttributeName: "userId"
	})
	test("create without peer", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([aliasesTable, usersTable], [])
		const alias = optimus.draftItem({
			table: aliasesTable,
			item: { id: "paul", firstLetter: "p", userId: "bbbb" }
		})

		await expect(optimus.commitItems({ items: [alias] })).rejects.toThrow(TableRelationshipViolationError)
	})
	test("delete without peer in the commit", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([aliasesTable, usersTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Aliases",
			Item: { id: "paul", firstLetter: "p", userId: "bbbb", version: 0 },
		}))
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Users",
			Item: { id: "bbbb", alias: "paul", version: 0 },
		}))
		const alias = await optimus.getItem({ table: aliasesTable, key: { id: "paul" } })
		const user = await optimus.getItem({ table: usersTable, key: { id: "bbbb" } })
		optimus.markItemForDeletion({ item: alias })
		optimus.markItemForDeletion({ item: user })

		await expect(optimus.commitItems({ items: [alias] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [user] })).rejects.toThrow(TableRelationshipViolationError)
	})
	test("item changes ID and peer isn't in the commit", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([aliasesTable, usersTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Aliases",
			Item: { id: "paul", firstLetter: "p", userId: "bbbb", version: 0 },
		}))
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Users",
			Item: { id: "bbbb", alias: "paul", version: 0 },
		}))
		const alias = await optimus.getItem({ table: aliasesTable, key: { id: "paul" } })
		const user = await optimus.getItem({ table: usersTable, key: { id: "bbbb" } })
		user.id = "cccc"

		await expect(optimus.commitItems({ items: [user] })).rejects.toThrow(TableRelationshipViolationError)
	})
	test("item changes ID and peer isn't updated", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([aliasesTable, usersTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Aliases",
			Item: { id: "paul", firstLetter: "p", userId: "bbbb", version: 0 },
		}))
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Users",
			Item: { id: "bbbb", alias: "paul", version: 0 },
		}))
		const alias = await optimus.getItem({ table: aliasesTable, key: { id: "paul" } })
		const user = await optimus.getItem({ table: usersTable, key: { id: "bbbb" } })
		user.id = "cccc"

		await expect(optimus.commitItems({ items: [alias, user] })).rejects.toThrow(TableRelationshipViolationError)
	})
	test("item changes its pointer and peer isn't updated", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([aliasesTable, usersTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Aliases",
			Item: { id: "paul", firstLetter: "p", userId: "bbbb", version: 0 },
		}))
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Users",
			Item: { id: "bbbb", alias: "paul", version: 0 },
		}))
		const alias = await optimus.getItem({ table: aliasesTable, key: { id: "paul" } })
		const user = await optimus.getItem({ table: usersTable, key: { id: "bbbb" } })
		alias.userId = "cccc"

		await expect(optimus.commitItems({ items: [alias, user] })).rejects.toThrow(TableRelationshipViolationError)
	})
	test("item changes its ID and peer isn't in the commit", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([aliasesTable, usersTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Aliases",
			Item: { id: "paul", firstLetter: "p", userId: "bbbb", version: 0 },
		}))
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Users",
			Item: { id: "bbbb", alias: "paul", version: 0 },
		}))
		const alias = await optimus.getItem({ table: aliasesTable, key: { id: "paul" } })
		const user = await optimus.getItem({ table: usersTable, key: { id: "bbbb" } })
		user.id = "cccc"
		alias.userId = "cccc"

		await expect(optimus.commitItems({ items: [user] })).rejects.toThrow(TableRelationshipViolationError)
	})
	test("item changes its pointer and peer isn't in the commit", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([aliasesTable, usersTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Aliases",
			Item: { id: "paul", firstLetter: "p", userId: "bbbb", version: 0 },
		}))
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Users",
			Item: { id: "bbbb", alias: "paul", version: 0 },
		}))
		const alias = await optimus.getItem({ table: aliasesTable, key: { id: "paul" } })
		const user = await optimus.getItem({ table: usersTable, key: { id: "bbbb" } })
		user.id = "cccc"
		alias.userId = "cccc"

		await expect(optimus.commitItems({ items: [alias] })).rejects.toThrow(TableRelationshipViolationError)
	})
	test("both are updated properly", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([aliasesTable, usersTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Aliases",
			Item: { id: "paul", firstLetter: "p", userId: "bbbb", version: 0 },
		}))
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Users",
			Item: { id: "bbbb", alias: "paul", version: 0 },
		}))
		const alias = await optimus.getItem({ table: aliasesTable, key: { id: "paul" } })
		const user = await optimus.getItem({ table: usersTable, key: { id: "bbbb" } })
		user.id = "cccc"
		alias.userId = "cccc"

		await optimus.commitItems({ items: [alias, user] })
		expect((await ddbDocumentClient.send(new GetCommand({
			TableName: "Aliases",
			Key: { id: "paul" },
			ConsistentRead: true
		}))).Item).toStrictEqual({ id: "paul", firstLetter: "p", userId: "cccc", version: 1 })
		expect((await ddbDocumentClient.send(new GetCommand({
			TableName: "Users",
			Key: { id: "cccc" },
			ConsistentRead: true
		}))).Item).toStrictEqual({ id: "cccc", alias: "paul", version: 0 })
	})

	test("creating and switching peers", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([aliasesTable, usersTable], [])
		const userId = "bbbb"
		const paulAlias = optimus.draftItem({
			table: aliasesTable,
			item: { id: "paul", firstLetter: "p", userId: userId }
		})
		const user = optimus.draftItem({
			table: usersTable,
			item: { id: userId, alias: paulAlias.id }
		})

		await optimus.commitItems({ items: [paulAlias, user] })
		expect((await ddbDocumentClient.send(new GetCommand({
			TableName: "Aliases",
			Key: { id: "paul" },
			ConsistentRead: true
		}))).Item).toStrictEqual({ id: "paul", firstLetter: "p", userId: "bbbb", version: 0 })
		expect((await ddbDocumentClient.send(new GetCommand({
			TableName: "Users",
			Key: { id: "bbbb" },
			ConsistentRead: true
		}))).Item).toStrictEqual({ id: "bbbb", alias: "paul", version: 0 })

		const pabloAlias = optimus.draftItem({
			table: aliasesTable,
			item: { id: "pablo", firstLetter: "p", userId: "bbbb" }
		})
		optimus.markItemForDeletion({ item: paulAlias })
		user.alias = "pablo"
		
		await expect(optimus.commitItems({ items: [paulAlias] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [pabloAlias] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [user] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [paulAlias, user] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [pabloAlias, user] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [paulAlias, pabloAlias] })).rejects.toThrow(TableRelationshipViolationError)
		await optimus.commitItems({ items: [paulAlias, pabloAlias, user] })
	})
})

describe("composite key table ONE_TO_ONE relationship", () => {
	const aliasesTable = new Table({
		tableName: "Aliases",
		itemShape: s.object({
			firstLetter: s.string(),
			ending: s.string(),
			userId: s.string()
		}),
		partitionKey: "firstLetter",
		sortKey: "ending"
	})
	const usersTable = new Table({
		tableName: "Users",
		itemShape: s.object({
			id: s.string(),
			alias: s.string()
		}),
		partitionKey: "id"
	})
	usersTable.addRelationship({
		type: TableRelationshipType.ONE_TO_ONE,
		pointerAttributeName: "alias",
		peerTable: aliasesTable,
		peerPointerAttributeName: "userId",
		compositeKeySeparator: ""
	})
	test("creating and switching peers", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([aliasesTable, usersTable], [])
		const userId = "bbbb"
		const paulAlias = optimus.draftItem({
			table: aliasesTable,
			item: { firstLetter: "p", ending: "aul", userId: userId }
		})
		const user = optimus.draftItem({
			table: usersTable,
			item: { id: userId, alias: `${paulAlias.firstLetter}${paulAlias.ending}` }
		})
		await optimus.commitItems({ items: [paulAlias, user] })

		const pabloAlias = optimus.draftItem({
			table: aliasesTable,
			item: { firstLetter: "p", ending: "ablo", userId: "bbbb" }
		})
		optimus.markItemForDeletion({ item: paulAlias })
		user.alias = "pablo"
		
		await expect(optimus.commitItems({ items: [paulAlias] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [pabloAlias] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [user] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [paulAlias, user] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [pabloAlias, user] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [paulAlias, pabloAlias] })).rejects.toThrow(TableRelationshipViolationError)
		await optimus.commitItems({ items: [paulAlias, pabloAlias, user] })
	})
	test("item changes its ID and peer isn't in the commit", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([aliasesTable, usersTable], [])
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Aliases",
			Item: { firstLetter: "p", ending: "aul", userId: "bbbb", version: 0 },
		}))
		await ddbDocumentClient.send(new PutCommand({
			TableName: "Users",
			Item: { id: "bbbb", alias: "paul", version: 0 },
		}))
		const alias = await optimus.getItem({ table: aliasesTable, key: { firstLetter: "p", ending: "aul" } })
		const user = await optimus.getItem({ table: usersTable, key: { id: "bbbb" } })
		user.id = "cccc"
		alias.userId = "cccc"

		await expect(optimus.commitItems({ items: [user] })).rejects.toThrow(TableRelationshipViolationError)
	})
})

describe("regular MANY_TO_MANY relationship", () => {
	const usersTable = new Table({
		tableName: "Users",
		itemShape: s.object({
			id: s.string(),
			name: s.string(),
			resourceIds: s.array(s.integer())
		}),
		partitionKey: "id"
	})
	const resourcesTable = new Table({
		tableName: "Resources",
		itemShape: s.object({
			id: s.integer(),
			sharedUserIds: s.array(s.string())
		}),
		partitionKey: "id"
	})
	usersTable.addRelationship({
		type: TableRelationshipType.MANY_TO_MANY,
		pointerAttributeName: "resourceIds",
		peerTable: resourcesTable,
		peerPointerAttributeName: "sharedUserIds"
	})
	test("both created", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([usersTable, resourcesTable], [])
		const userId = "bbbb"
		const resourceId = 1111
		const user = optimus.draftItem({ table: usersTable, item: { id: userId, name: "paul", resourceIds: [resourceId] } })
		const resource = optimus.draftItem({ table: resourcesTable, item: { id: resourceId, sharedUserIds: [userId] } })

		await optimus.commitItems({ items: [user, resource] })
	})
	test("create with peer not having pointer", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([usersTable, resourcesTable], [])
		const userId = "bbbb"
		const resourceId = 1111
		const user = optimus.draftItem({ table: usersTable, item: { id: userId, name: "paul", resourceIds: [resourceId] } })
		const resource = optimus.draftItem({ table: resourcesTable, item: { id: resourceId, sharedUserIds: [] } })

		await expect(optimus.commitItems({ items: [user, resource] })).rejects.toThrow(TableRelationshipViolationError)
	})
	test("orphaned peer after key change", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([usersTable, resourcesTable], [])
		const user = optimus.draftItem({ table: usersTable, item: { id: "bbbb", name: "paul", resourceIds: [1111] } })
		const resource = optimus.draftItem({ table: resourcesTable, item: { id: 1111, sharedUserIds: ["bbbb"] } })
		await optimus.commitItems({ items: [user, resource] })
		user.id = "cccc"

		await expect(optimus.commitItems({ items: [user, resource] })).rejects.toThrow(TableRelationshipViolationError)
	})
	test("create a 2x2", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([usersTable, resourcesTable], [])
		const userIds = ["aaaa", "bbbb"]
		const resourceIds = [1111, 2222]
		const user0 = optimus.draftItem({ table: usersTable, item: { id: userIds[0], name: "paul", resourceIds: resourceIds } })
		const user1 = optimus.draftItem({ table: usersTable, item: { id: userIds[1], name: "pablo", resourceIds: resourceIds } })
		const resource0 = optimus.draftItem({ table: resourcesTable, item: { id: resourceIds[0], sharedUserIds: userIds } })
		const resource1 = optimus.draftItem({ table: resourcesTable, item: { id: resourceIds[1], sharedUserIds: userIds } })

		await expect(optimus.commitItems({ items: [user0] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [user0, resource0] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [user0, user1] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [user0, user1, resource0] })).rejects.toThrow(TableRelationshipViolationError)
		await optimus.commitItems({ items: [user0, user1, resource0, resource1] })
	})
})

describe("regular ONE_TO_MANY/MANY_TO_ONE relationship", () => {
	const forumsTable = new Table({
		tableName: "Forums",
		itemShape: s.object({
			id: s.string(),
			title: s.string(),
			commentIds: s.array(s.string())
		}),
		partitionKey: "id"
	})
	const commentsTable = new Table({
		tableName: "Comments",
		itemShape: s.object({
			id: s.string(),
			forumId: s.string(),
			text: s.string()
		}),
		partitionKey: "id"
	})
	forumsTable.addRelationship({
		type: TableRelationshipType.ONE_TO_MANY,
		pointerAttributeName: "commentIds",
		peerTable: commentsTable,
		peerPointerAttributeName: "forumId"
	})
	test("create comment without forum pointing to it", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([forumsTable, commentsTable], [])
		const forum = optimus.draftItem({ table: forumsTable, item: { id: "bbbb", title: "forum 1", commentIds: [] } })
		const comment = optimus.draftItem({ table: commentsTable, item: { id: "1111", forumId: forum.id, text: "hello" } })

		await expect(optimus.commitItems({ items: [forum, comment] })).rejects.toThrow(TableRelationshipViolationError)
	})
	test("create forum without comment pointing to it", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([forumsTable, commentsTable], [])
		const comment = optimus.draftItem({ table: commentsTable, item: { id: "1111", forumId: "aaaa", text: "hello" } })
		const forum = optimus.draftItem({ table: forumsTable, item: { id: "bbbb", title: "forum 1", commentIds: [comment.id] } })

		await expect(optimus.commitItems({ items: [forum, comment] })).rejects.toThrow(TableRelationshipViolationError)
	})

	test("multiple comments to a forum", async () => {
		const [optimus, ddbDocumentClient] = await prepDdbTest([forumsTable, commentsTable], [])
		const forum = optimus.draftItem({ table: forumsTable, item: { id: "bbbb", title: "forum 1", commentIds: new Array<string>() } })
		await optimus.commitItems({ items: [forum] })

		const comment0 = optimus.draftItem({ table: commentsTable, item: { id: "0000", forumId: forum.id, text: "hello" } })
		forum.commentIds.push(comment0.id)
		await optimus.commitItems({ items: [forum, comment0] })

		const comment1 = optimus.draftItem({ table: commentsTable, item: { id: "1111", forumId: forum.id, text: "hi" } })
		forum.commentIds.push(comment1.id)
		await optimus.commitItems({ items: [forum, comment0, comment1] })

		const comment2 = optimus.draftItem({ table: commentsTable, item: { id: "2222", forumId: forum.id, text: "hey" } })
		forum.commentIds.push(comment2.id)
		await optimus.commitItems({ items: [forum, comment2] })

		optimus.markItemForDeletion({ item: comment1 })
		await expect(optimus.commitItems({ items: [comment1] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [forum, comment1] })).rejects.toThrow(TableRelationshipViolationError)

		forum.commentIds = forum.commentIds.filter(commentId => commentId !== comment1.id)
		await expect(optimus.commitItems({ items: [comment1] })).rejects.toThrow(TableRelationshipViolationError)
		await expect(optimus.commitItems({ items: [forum] })).rejects.toThrow(TableRelationshipViolationError)
		await optimus.commitItems({ items: [forum, comment1] })
	})
})