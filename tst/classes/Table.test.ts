import { s } from "shape-tape"
import { Table } from "../../src"

test("with version attribute", () => {
	expect(() => {
		const fruitTable = new Table({
			tableName: "Fruit",
			itemShape: s.dictionary({
				id: s.string(),
				state: s.union([s.literal("available"), s.literal("deleted")]),
				version: s.number()
			}),
			partitionKey: "id"
		})
	}).toThrow(new Error(`Fruit table's item shape includes reserved attribute name "version".`))
})