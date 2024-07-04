import { s } from "shape-tape"
import { Table } from "../../src"

const fruitShape = s.object({
	id: s.string(),
	state: s.union([s.literal("available"), s.literal("deleted")])
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
	const documentShape = s.object({
		userId: s.string(),
		id: s.string(),
		text: s.string()
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
			itemShape: s.object({
				id: s.string(),
				state: s.union([s.literal("available"), s.literal("deleted")]),
				version: s.number()
			}),
			partitionKey: "id"
		})
	}).toThrow(new Error(`Fruit table's item shape includes reserved version attribute "version".`))
})

test("with shape including custom version attribute", () => {
	expect(() => {
		const fruitTable = new Table({
			tableName: "Fruit",
			itemShape: s.object({
				id: s.string(),
				state: s.union([s.literal("available"), s.literal("deleted")]),
				optimisticLockVersion: s.number()
			}),
			partitionKey: "id",
			versionAttribute: "optimisticLockVersion"
		})
	}).toThrow(new Error(`Fruit table's item shape includes reserved version attribute "optimisticLockVersion".`))
})

test("table from UnionShape", () => {
	const resourceEventShape = s.union([
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
