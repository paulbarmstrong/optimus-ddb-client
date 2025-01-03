import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"
import { prepDdbTest } from "../../test-utilities/DynamoDb"
import { MyError, connectionsTable, connectionsTableResourceIdGsi, livestreamsTable, livestreamsTableViewerCountGsi, resourceEventsTable, resourcesTable } from "../../test-utilities/Constants"
import { Gsi, InvalidResumeKeyError, OptimusDdbClient } from "../../../src"

describe("with normal tables", () => {
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
			const [resources, resumeKey] = await optimus.queryItems({
				index: resourcesTable,
				partitionKeyCondition: ["id", "=", "4567"]
			})
			expect(resources).toStrictEqual([])
			expect(resumeKey).toStrictEqual(undefined)
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
				filterCondition: ["status", "=", "deleted"]
			})
			expect(resources).toStrictEqual([])
		})

		test("filter condition with result", async () => {
			const [resources, resumeKey] = await optimus.queryItems({
				index: resourcesTable,
				partitionKeyCondition: ["id", "=", "aaaa"],
				filterCondition: ["status", "<>", "deleted"]
			})
			expect(resources).toStrictEqual([{ id: "aaaa", status: "available", updatedAt: 1702185430122 }])
			expect(resumeKey).toStrictEqual(undefined)
		})
	})

	describe("table with sort key", () => {
		describe("query by partition key only", () => {
			test("no results", async () => {
				const [connections, resumeKey] = await optimus.queryItems({
					index: connectionsTable,
					partitionKeyCondition: ["id", "=", "4567"]
				})
				expect(connections).toStrictEqual([])
				expect(resumeKey).toStrictEqual(undefined)
			})

			test("one result", async () => {
				const [connections] = await optimus.queryItems({
					index: connectionsTable,
					partitionKeyCondition: ["id", "=", "5555"]
				})
				expect(connections).toStrictEqual([{ id: "5555", resourceId: "cccc", updatedAt: 1702186486734 }])
			})

			test("multiple results", async () => {
				const [connections, resumeKey] = await optimus.queryItems({
					index: connectionsTable,
					partitionKeyCondition: ["id", "=", "4568"]
				})
				expect(connections).toStrictEqual([
					{ id: "4568", resourceId: "aaaa", updatedAt: 1702186485444 },
					{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 },
					{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
				])
				expect(resumeKey).toStrictEqual(undefined)
			})
			
			test("scanIndexForward=false", async () => {
				const [connections, resumeKey] = await optimus.queryItems({
					index: connectionsTable,
					partitionKeyCondition: ["id", "=", "4568"],
					scanIndexForward: false
				})
				expect(connections).toStrictEqual([
					{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 },
					{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 },
					{ id: "4568", resourceId: "aaaa", updatedAt: 1702186485444 }
				])
				expect(resumeKey).toStrictEqual(undefined)
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
				filterCondition: ["updatedAt", "=", 1702183489321]
			})
			expect(connections).toStrictEqual([
				{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 }
			])
		})

		test("!= filter condition", async () => {
			for (const neq of ["!=", "<>"] as const) {
				const [connections] = await optimus.queryItems({
					index: connectionsTable,
					partitionKeyCondition: ["id", "=", "4568"],
					sortKeyCondition: ["resourceId", ">", "aaaa"],
					filterCondition: ["updatedAt", neq, 1702183489321]
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
				filterCondition: ["updatedAt", "<", 1702183489321]
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
				filterCondition: ["updatedAt", ">", 1702183485312]
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
				filterCondition: ["updatedAt", "<=", 1702183489321]
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
				filterCondition: ["updatedAt", ">=", 1702183489321]
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
				filterCondition: ["updatedAt", "between", 1702183489321, "and", 1702183489321]
			})
			expect(connections).toStrictEqual([
				{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 }
			])
		})

		test("exists filter condition", async () => {
			const [connections] = await optimus.queryItems({
				index: connectionsTable,
				partitionKeyCondition: ["id", "=", "4568"],
				filterCondition: ["ttl", "exists"]
			})
			expect(connections).toStrictEqual([
				{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
			])
		})
		
		test("exists filter condition", async () => {
			const [connections] = await optimus.queryItems({
				index: connectionsTable,
				partitionKeyCondition: ["id", "=", "4568"],
				filterCondition: ["ttl", "doesn't exist"]
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
				filterCondition: ["updatedAt", "in", [1702183489321, 1702183485312]]
			})
			expect(connections).toStrictEqual([
				{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 },
				{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
			])
		})

		test("in pages", async () => {
			const [connections0, resumeKey0] = await optimus.queryItems({
				index: connectionsTable,
				partitionKeyCondition: ["id", "=", "4568"],
				limit: 2
			})
			expect(connections0).toStrictEqual([
				{ id: "4568", resourceId: "aaaa", updatedAt: 1702186485444 },
				{ id: "4568", resourceId: "bbbb", updatedAt: 1702183489321 }
			])
			expect(resumeKey0).toBeDefined
			const [connections1, resumeKey1] = await optimus.queryItems({
				index: connectionsTable,
				partitionKeyCondition: ["id", "=", "4568"],
				limit: 2,
				resumeKey: resumeKey0
			})
			expect(connections1).toStrictEqual([
				{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
			])
			expect(resumeKey1).toBeUndefined
		})
	})

	describe("for a GSI", () => {
		test("multiple results", async () => {
			const [connections, resumeKey0] = await optimus.queryItems({
				index: connectionsTableResourceIdGsi,
				partitionKeyCondition: ["resourceId", "=", "cccc"]
			})
			expect(connections).toStrictEqual([
				{ id: "5555", resourceId: "cccc", updatedAt: 1702186486734 },
				{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 },
			])
			expect(resumeKey0).toBeUndefined
		})

		test("in pages", async () => {
			const [connections0, resumeKey0] = await optimus.queryItems({
				index: connectionsTableResourceIdGsi,
				partitionKeyCondition: ["resourceId", "=", "cccc"],
				limit: 1
			})
			expect(connections0).toStrictEqual([
				{ id: "5555", resourceId: "cccc", updatedAt: 1702186486734 }
			])
			expect(resumeKey0).toBeDefined
			const [connections1, resumeKey1] = await optimus.queryItems({
				index: connectionsTableResourceIdGsi,
				partitionKeyCondition: ["resourceId", "=", "cccc"],
				limit: 1,
				resumeKey: resumeKey0
			})
			expect(connections1).toStrictEqual([
				{ id: "4568", resourceId: "cccc", updatedAt: 1702183485312, ttl: 1702185485312 }
			])
			expect(resumeKey1).toBeUndefined
		})
	})

	test("invalid resumeKey", async () => {
		await expect(optimus.queryItems({
			index: resourcesTable,
			partitionKeyCondition: ["id", "=", "4568"],
			resumeKey: "uihdwaulidnw"
		})).rejects.toThrow(InvalidResumeKeyError)
	})

	test("invalid resumeKey with invalidResumeKeyErrorOverride", async () => {
		await expect(optimus.queryItems({
			index: resourcesTable,
			partitionKeyCondition: ["id", "=", "4568"],
			resumeKey: "uihdwaulidnw",
			invalidResumeKeyErrorOverride: _ => new MyError()
		})).rejects.toThrow(MyError)
	})
})

test("incomplete item in GSI", async () => {
	const [optimus, dynamoDBDocumentClient] = await prepDdbTest([livestreamsTable], [livestreamsTableViewerCountGsi], "KEYS_ONLY")
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Livestreams",
		Item: { id: "aaaa", category: "livestreams", viewerCount: 2, metadata: new Uint8Array(64), version: 0 }
	}))
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: "Livestreams",
		Item: { id: "bbbb", category: "livestreams", viewerCount: 3, metadata: new Uint8Array(64), version: 0 }
	}))

	const [results] = await optimus.queryItems({
		index: livestreamsTableViewerCountGsi,
		partitionKeyCondition: ["category", "=", "livestreams"],
		scanIndexForward: false
	})

	expect(results).toStrictEqual([
		{ id: "bbbb", category: "livestreams", viewerCount: 3, metadata: new Uint8Array(64) },
		{ id: "aaaa", category: "livestreams", viewerCount: 2, metadata: new Uint8Array(64) }
	])
})

describe("Table with union itemSchema", () => {
	const resourceEventsTableCommentGsi = new Gsi({
		table: resourceEventsTable,
		partitionKey: "type",
		sortKey: "comment",
		indexName: "comment"
	})
	let optimus: OptimusDdbClient
	let ddbDocumentClient: DynamoDBDocumentClient
	beforeAll(async () => {
		const prepRes = await prepDdbTest([resourceEventsTable], [resourceEventsTableCommentGsi])
		optimus = prepRes[0]
		ddbDocumentClient = prepRes[1]
		await ddbDocumentClient.send(new PutCommand({
			TableName: "ResourceEvents",
			Item: { id: "cccc", type: "new-comment", comment: "hi", version: 0 }
		}))
		await ddbDocumentClient.send(new PutCommand({
			TableName: "ResourceEvents",
			Item: { id: "dddd", type: "new-comment", comment: "hello", version: 0 }
		}))
		await ddbDocumentClient.send(new PutCommand({
			TableName: "ResourceEvents",
			Item: { id: "eeee", type: "title-change", title: "new document", version: 0 }
		}))
	})
	test("normal case", async () => {
		const [results] = await optimus.queryItems({
			index: resourceEventsTable,
			partitionKeyCondition: ["id", "=", "dddd"],
		})
		expect(results).toStrictEqual([
			{ id: "dddd", type: "new-comment", comment: "hello" },
		])
	})
	test("where GSI PK isn't in every union member", async () => {
		const [results] = await optimus.queryItems({
			index: resourceEventsTableCommentGsi,
			partitionKeyCondition: ["type", "=", "new-comment"],
			sortKeyCondition: ["comment", "begins with", "h"],
			filterCondition: ["id", "between", "aaaa", "and", "fffff"]
		})
	
		expect(results).toStrictEqual([
			{ id: "dddd", type: "new-comment", comment: "hello" },
			{ id: "cccc", type: "new-comment", comment: "hi" }
		])
	})
})
