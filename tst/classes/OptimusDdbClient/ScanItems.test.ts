import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"
import { prepDdbTest } from "../../test-utilities/DynamoDb"
import { Gsi, InvalidResumeKeyError, OptimusDdbClient } from "../../../src"
import { MyError, connectionsTable, connectionsTableResourceIdGsi, livestreamsTable, livestreamsTableViewerCountGsi, resourceEventsTable, resourcesTable } from "../../test-utilities/Constants"

let optimus: OptimusDdbClient
let dynamoDBDocumentClient: DynamoDBDocumentClient

describe("with normal tables", () => {
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
		for (const neq of ["!=", "<>"] as const) {
			const [resources] = await optimus.scanItems({
				index: resourcesTable,
				filterConditions: [["status", neq, "available"]]
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
		const [resources0, resumeKey0] = await optimus.scanItems({
			index: resourcesTable,
			limit: 1
		})
		expect(resources0).toStrictEqual([
			{ id: "aaaa", status: "available", updatedAt: 1702185590000 },
		])
		expect(resumeKey0).not.toStrictEqual(undefined)
		const [resources1, resumeKey1] = await optimus.scanItems({
			index: resourcesTable,
			limit: 1,
			resumeKey: resumeKey0
		})
		expect(resources1).toStrictEqual([
			{ id: "bbbb", status: "available", updatedAt: 1702185591111 }
		])
		expect(resumeKey1).not.toStrictEqual(undefined)
		const [resources2, resumeKey2] = await optimus.scanItems({
			index: resourcesTable,
			limit: 1,
			resumeKey: resumeKey1
		})
		expect(resources2).toStrictEqual([
			{ id: "cccc", status: "deleted", updatedAt: 1702185592222 }
		])
		expect(resumeKey2).not.toStrictEqual(undefined)
	})

	test("invalid resumeKey", async () => {
		await expect(optimus.scanItems({
			index: resourcesTable,
			resumeKey: "uihdwaulidnw"
		})).rejects.toThrow(InvalidResumeKeyError)
	})

	test("invalid resumeKey with invalidResumeKeyErrorOverride", async () => {
		await expect(optimus.scanItems({
			index: resourcesTable,
			resumeKey: "uihdwaulidnw",
			invalidResumeKeyErrorOverride: _ => new MyError()
		})).rejects.toThrow(MyError)
	})

	describe("from a gsi", () => {
		test("=", async () => {
			const [connections, resumeKey] = await optimus.scanItems({
				index: connectionsTableResourceIdGsi,
				filterConditions: [["updatedAt", "=", 1702186485444]]
			})
			expect(connections).toStrictEqual([
				{ id: "4568", resourceId: "dddd", updatedAt: 1702186485444 }
			])
			expect(resumeKey).toBeUndefined
		})
		
		test("in pages", async () => {
			const [connections0, resumeKey0] = await optimus.queryItems({
				index: connectionsTableResourceIdGsi,
				partitionKeyCondition: ["resourceId", "=", "dddd"],
				limit: 1
			})
			expect(connections0).toStrictEqual([
				{ id: "4568", resourceId: "dddd", updatedAt: 1702186485444 }
			])
			expect(resumeKey0).toBeDefined
			const [connections1, resumeKey1] = await optimus.queryItems({
				index: connectionsTableResourceIdGsi,
				partitionKeyCondition: ["resourceId", "=", "dddd"],
				limit: 1,
				resumeKey: resumeKey0
			})
			expect(connections1).toStrictEqual([
				{ id: "4999", resourceId: "dddd", updatedAt: 1702186465344 }
			])
			expect(resumeKey1).toBeUndefined
		})
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

	const [results] = await optimus.scanItems({
		index: livestreamsTableViewerCountGsi
	})

	expect(results).toStrictEqual([
		{ id: "aaaa", category: "livestreams", viewerCount: 2, metadata: new Uint8Array(64) },
		{ id: "bbbb", category: "livestreams", viewerCount: 3, metadata: new Uint8Array(64) }
	])
})

describe("Table with UnionShape itemShape", () => {
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
	test("2 pages", async () => {
		const [results0, resumeKey0] = await optimus.scanItems({
			index: resourceEventsTable,
			filterConditions: [["type", "=", "new-comment"]],
			limit: 1
		})
		expect(results0).toStrictEqual([{ id: "dddd", type: "new-comment", comment: "hello" }])
		expect(typeof resumeKey0).toStrictEqual("string")
		const [results1, resumeKey1] = await optimus.scanItems({
			index: resourceEventsTable,
			filterConditions: [["type", "=", "new-comment"]],
			resumeKey: resumeKey0,
			limit: 1
		})
		expect(results1).toStrictEqual([{ id: "cccc", type: "new-comment", comment: "hi" }])
		expect(resumeKey1).toBeUndefined
	})
	test("where GSI PK isn't in every union member", async () => {
		const [results] = await optimus.scanItems({
			index: resourceEventsTableCommentGsi,
			filterConditions: [["id", "!=", "cccc"]]
		})
		expect(results).toStrictEqual([
			{ id: "dddd", type: "new-comment", comment: "hello" }
		])
	})
})
