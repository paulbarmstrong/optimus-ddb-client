import { z } from "zod"
import { Table } from "../../src"

const fruitShape = z.strictObject({
	id: z.string(),
	state: z.union([z.literal("available"), z.literal("deleted")])
})

test("regular table", () => {
	const fruitTable = new Table({
		tableName: "Fruit",
		itemShape: fruitShape,
		partitionKey: "id"
	})
	expect(fruitTable.attributeNames).toStrictEqual(["id", "state"])
	expect(fruitTable.itemShape).toStrictEqual(fruitShape)
	expect(fruitTable.keyAttributeNames).toStrictEqual(["id"])
	expect(fruitTable.partitionKey).toStrictEqual("id")
	expect(fruitTable.sortKey).toBeUndefined()
	expect(fruitTable.tableName).toStrictEqual("Fruit")
	expect(fruitTable.versionAttributeName).toStrictEqual("version")
})

test("table with sort key and custom version attribute", () => {
	const documentShape = z.strictObject({
		userId: z.string(),
		id: z.string(),
		text: z.string()
	})
	const documentsTable = new Table({
		tableName: "Documents",
		itemShape: documentShape,
		partitionKey: "userId",
		sortKey: "id",
		versionAttribute: "_version"
	})
	expect(documentsTable.attributeNames).toStrictEqual(["userId", "id", "text"])
	expect(documentsTable.itemShape).toStrictEqual(documentShape)
	expect(documentsTable.keyAttributeNames).toStrictEqual(["userId", "id"])
	expect(documentsTable.partitionKey).toStrictEqual("userId")
	expect(documentsTable.sortKey).toStrictEqual("id")
	expect(documentsTable.tableName).toStrictEqual("Documents")
	expect(documentsTable.versionAttributeName).toStrictEqual("_version")
})

test("with shape including version attribute", () => {
	expect(() => {
		const fruitTable = new Table({
			tableName: "Fruit",
			itemShape: z.strictObject({
				id: z.string(),
				state: z.union([z.literal("available"), z.literal("deleted")]),
				version: z.number()
			}),
			partitionKey: "id"
		})
	}).toThrow(new Error(`Fruit table's item shape includes reserved version attribute "version".`))
})

test("with shape including custom version attribute", () => {
	expect(() => {
		const fruitTable = new Table({
			tableName: "Fruit",
			itemShape: z.strictObject({
				id: z.string(),
				state: z.union([z.literal("available"), z.literal("deleted")]),
				optimisticLockVersion: z.number()
			}),
			partitionKey: "id",
			versionAttribute: "optimisticLockVersion"
		})
	}).toThrow(new Error(`Fruit table's item shape includes reserved version attribute "optimisticLockVersion".`))
})

test("table from UnionShape", () => {
	const resourceEventShape = z.union([
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
	const resourceEventsTable = new Table({
		tableName: "ResourceEvents",
		itemShape: resourceEventShape,
		partitionKey: "id"
	})
	expect(resourceEventsTable.attributeNames).toStrictEqual(["id", "type", "title", "comment"])
	expect(resourceEventsTable.itemShape).toStrictEqual(resourceEventShape)
	expect(resourceEventsTable.keyAttributeNames).toStrictEqual(["id"])
	expect(resourceEventsTable.partitionKey).toStrictEqual("id")
	expect(resourceEventsTable.sortKey).toBeUndefined()
	expect(resourceEventsTable.tableName).toStrictEqual("ResourceEvents")
	expect(resourceEventsTable.versionAttributeName).toStrictEqual("version")
})
