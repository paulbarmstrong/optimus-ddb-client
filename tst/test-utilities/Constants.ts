import { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb"
import { Gsi, Table } from "../../src"
import * as z from "zod"

export const DYNAMO_DB_LOCAL_PORT: number = 8000
export const DYNAMO_DB_LOCAL_CLIENT_CONFIG: DynamoDBClientConfig = {
	endpoint: `http://localhost:${DYNAMO_DB_LOCAL_PORT}`,
	region: "local-env",
	credentials: {
		accessKeyId: "fakeMyKeyId",
		secretAccessKey: "fakeSecretAccessKey"
	}
}

export class MyError extends Error {}

export const resourceZod = z.strictObject({
	id: z.string(),
	status: z.union([z.literal("available"), z.literal("deleted")]),
	updatedAt: z.number().int()
})
export type Resource = z.infer<typeof resourceZod>
export const resourcesTable = new Table({
	tableName: "Resources",
	itemSchema: resourceZod,
	partitionKey: "id"
})

export const connectionZod = z.strictObject({
	id: z.string(),
	resourceId: z.string(),
	updatedAt: z.number().int(),
	ttl: z.optional(z.number().int())
})
export type Connection = z.infer<typeof connectionZod>
export const connectionsTable = new Table({
	tableName: "Connections",
	itemSchema: connectionZod,
	partitionKey: "id",
	sortKey: "resourceId"
})
export const connectionsTableResourceIdGsi = new Gsi({
	table: connectionsTable,
	indexName: "resource-id",
	partitionKey: "resourceId"
})

export const livestreamZod = z.strictObject({
	id: z.string(),
	category: z.literal("livestreams"),
	viewerCount: z.number().int().min(0),
	metadata: z.instanceof(Uint8Array)
})
export type Livestream = z.infer<typeof livestreamZod>
export const livestreamsTable = new Table({
	tableName: "Livestreams",
	itemSchema: livestreamZod,
	partitionKey: "id"
})
export const livestreamsTableViewerCountGsi = new Gsi({
	table: livestreamsTable,
	indexName: "category-viewerCount",
	partitionKey: "category",
	sortKey: "viewerCount"
})

export const resourceEventZod = z.union([
	z.strictObject({
		id: z.string(),
		type: z.literal("title-change"),
		title: z.string()
	}),
	z.strictObject({
		id: z.string(),
		type: z.literal("new-comment"),
		comment: z.string()
	})
])
export type ResourceEvent = z.infer<typeof resourceEventZod>
export const resourceEventsTable = new Table({
	tableName: "ResourceEvents",
	itemSchema: resourceEventZod,
	partitionKey: "id"
})
