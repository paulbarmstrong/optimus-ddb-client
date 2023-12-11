import { ExpressionBuilder } from "../../src/classes/ExpressionBuilder"

test("normal case", () => {
	const builder: ExpressionBuilder = new ExpressionBuilder()
	expect(builder.addName("id")).toStrictEqual("#id_0")
	expect(builder.addValue("abcd")).toStrictEqual(":abcd_0")
	expect(builder.addName("status")).toStrictEqual("#status_0")
	expect(builder.addValue("available")).toStrictEqual(":available_0")
	expect(builder.addValue("deleted")).toStrictEqual(":deleted_0")
	expect(builder.addName("updatedAt")).toStrictEqual("#updatedAt_0")
	expect(builder.addValue(1701650313612)).toStrictEqual(":A1701650313612_0")
	expect(builder.attributeNames).toStrictEqual({
		"#id_0": "id",
		"#status_0": "status",
		"#updatedAt_0": "updatedAt",
	})
	expect(builder.attributeValues).toStrictEqual({
		":abcd_0": "abcd",
		":available_0": "available",
		":deleted_0": "deleted",
		":A1701650313612_0": 1701650313612
	})
})

test("duplicates", () => {
	const builder: ExpressionBuilder = new ExpressionBuilder()
	expect(builder.addName("status")).toStrictEqual("#status_0")
	expect(builder.addName("status")).toStrictEqual("#status_1")

	expect(builder.addValue("available")).toStrictEqual(":available_0")
	expect(builder.addValue("available")).toStrictEqual(":available_1")

	expect(builder.addValue(12)).toStrictEqual(":A12_0")
	expect(builder.addValue(12)).toStrictEqual(":A12_1")
})

test("invalid characters", () => {
	const builder: ExpressionBuilder = new ExpressionBuilder()
	expect(builder.addName("resource-status")).toStrictEqual("#resource_status_0")
	expect(builder.addName("resource~status")).toStrictEqual("#resource_status_1")
	expect(builder.addName("#resource~status")).toStrictEqual("#A_resource_status_0")
	expect(builder.addValue("~todo")).toStrictEqual(":A_todo_0")
	expect(builder.addValue("$todo")).toStrictEqual(":A_todo_1")
})

test("long content", () => {
	const builder: ExpressionBuilder = new ExpressionBuilder()
	expect(builder.addName("she_sells_sea_shells_by_the_sea_shore")).toStrictEqual("#she_sells_sea_sh_0")
	expect(builder.addName("she-sells-sea-shells-by-the-sea-shore")).toStrictEqual("#she_sells_sea_sh_1")
})
