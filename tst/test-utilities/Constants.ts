import { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb"
import { ShapeToType, s } from "shape-tape"
import { Gsi, Table } from "../../src"

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

export const resourceShape = s.object({
	id: s.string(),
	status: s.union([s.literal("available"), s.literal("deleted")]),
	updatedAt: s.integer()
})
export type Resource = ShapeToType<typeof resourceShape>
export const resourcesTable = new Table({
	tableName: "Resources",
	itemShape: resourceShape,
	partitionKey: "id"
})

export const connectionShape = s.object({
	id: s.string(),
	resourceId: s.string(),
	updatedAt: s.integer(),
	ttl: s.optional(s.integer())
})
export type Connection = ShapeToType<typeof connectionShape>
export const connectionsTable = new Table({
	tableName: "Connections",
	itemShape: connectionShape,
	partitionKey: "id",
	sortKey: "resourceId"
})
export const connectionsTableResourceIdGsi = new Gsi({
	table: connectionsTable,
	indexName: "resource-id",
	partitionKey: "resourceId"
})

export const livestreamShape = s.object({
	id: s.string(),
	category: s.literal("livestreams"),
	viewerCount: s.integer({min: 0}),
	metadata: s.class(Uint8Array)
})
export type Livestream = ShapeToType<typeof livestreamShape>
export const livestreamsTable = new Table({
	tableName: "Livestreams",
	itemShape: livestreamShape,
	partitionKey: "id"
})
export const livestreamsTableViewerCountGsi = new Gsi({
	table: livestreamsTable,
	indexName: "category-viewerCount",
	partitionKey: "category",
	sortKey: "viewerCount"
})

export const resourceEventShape = s.union([
	s.object({
		id: s.string(),
		type: s.literal("title-change"),
		title: s.string()
	}),
	s.object({
		id: s.string(),
		type: s.literal("new-comment"),
		comment: s.string()
	})
])
export type ResourceEvent = ShapeToType<typeof resourceEventShape>
export const resourceEventsTable = new Table({
	tableName: "ResourceEvents",
	itemShape: resourceEventShape,
	partitionKey: "id"
})