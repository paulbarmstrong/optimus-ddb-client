import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb"
import { Connection, Resource, connectionsTable, resourcesTable } from "../../test-utilities/Constants"
import { prepDdbTest } from "../../test-utilities/DynamoDb"
import { OptimisticLockError, Table } from "../../../src"
import { ShapeToType, s } from "shape-tape"
import crypto from "crypto"

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

test("README example", async () => {
	// Create Table class instances based on your DynamoDB tables.
	const blogPostsTable = new Table({
		tableName: "BlogPosts",
		itemShape: s.object({
			id: s.string(),
			name: s.string(),
			content: s.string(),
			numComments: s.integer()
		}),
		partitionKey: "id"
	})
	const commentsTable = new Table({
		tableName: "Comments",
		itemShape: s.object({
			blogPostId: s.string(),
			id: s.string(),
			content: s.string()
		}),
		partitionKey: "blogPostId",
		sortKey: "id"
	})

	// Perform operations on items in those tables.
	// Example scenario - Handling an API request for adding a comment to a blog post:
	async function handleCreateBlogPostComment(body: { blogPostId: string, commentContent: string }) {
		// Get the blog post
		const blogPost = await optimus.getItem({
			table: blogPostsTable,
			key: { id: body.blogPostId }
		})

		// Prepare a change to increase the blog post's numComments.
		blogPost.numComments = blogPost.numComments + 1

		// Prepare a new comment.
		const comment = optimus.draftItem({
			table: commentsTable,
			item: {
				blogPostId: body.blogPostId,
				id: crypto.randomUUID(),
				content: body.commentContent
			}
		})

		// Commit those changes in a transaction.
		await optimus.commitItems({ items: [blogPost, comment] })

		return { id: comment.id }
	}

	const [optimus, ddbDocumentClient] = await prepDdbTest([blogPostsTable, commentsTable], [])
	const blogPostId = crypto.randomUUID()
	await ddbDocumentClient.send(new PutCommand({
		TableName: "BlogPosts",
		Item: {
			id: blogPostId,
			name: "My blog post",
			content: "This is my blog post",
			numComments: 0,
			version: 0
		}
	}))

	const createCommentRes = await handleCreateBlogPostComment({ blogPostId: blogPostId, commentContent: "Nice blog post" })

	const blogPostItem = (await ddbDocumentClient.send(new GetCommand({
		TableName: "BlogPosts",
		Key: { id: blogPostId }
	}))).Item
	const commentItem = (await ddbDocumentClient.send(new GetCommand({
		TableName: "Comments",
		Key: {
			blogPostId: blogPostId,
			id: createCommentRes.id
		}
	}))).Item
	expect(blogPostItem).toStrictEqual({
		id: blogPostId,
		name: "My blog post",
		content: "This is my blog post",
		numComments: 1,
		version: 1
	})
	expect(commentItem).toStrictEqual({
		blogPostId: blogPostId,
		id: createCommentRes.id,
		content: "Nice blog post",
		version: 0
	})
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
	expect(optimus.commitItems({ items: [resource] })).rejects.toThrow("Parameter \"status\" is invalid.")
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
		expect(ffffItem).toStrictEqual({ id: "ffff", status: "available", updatedAt: 1702172261700, version: 11 })

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
		expect(ffffItem).toStrictEqual({ id: "ffff", status: "deleted", updatedAt: 1702172261700, version: 12 })
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
		expect(optimus.commitItems({ items: [resource] })).rejects.toThrow(OptimisticLockError)
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
		expect(optimus.commitItems({ items: [resource] })).rejects.toThrow(OptimisticLockError)
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