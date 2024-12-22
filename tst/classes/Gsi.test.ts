import { Gsi } from "../../src"
import { resourceEventsTable } from "../test-utilities/Constants"

test("from a table using union itemSchema", () => {
	const resourceEventsTableCommentGsi = new Gsi({
		table: resourceEventsTable,
		partitionKey: "comment",
		indexName: "comment"
	})
})
