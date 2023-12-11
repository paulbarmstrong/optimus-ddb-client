import { ExpressionBuilder } from "../src/classes/ExpressionBuilder"
import { getDynamoDbConditionExpressionString } from "../src/Utilities"

describe("getDynamoDbConditionExpressionString", () => {
	test("exists", () => {
		const builder: ExpressionBuilder = new ExpressionBuilder()
		expect(getDynamoDbConditionExpressionString(["expiresAt", "exists"], builder))
			.toStrictEqual("attribute_exists(#expiresAt_0)")
		expect(builder.attributeNames).toStrictEqual({ "#expiresAt_0": "expiresAt" })
		expect(builder.attributeValues).toStrictEqual({})
	})
	describe("in", () => {
		test("string", () => {
			const builder: ExpressionBuilder = new ExpressionBuilder()
			expect(getDynamoDbConditionExpressionString(["status", "in", ["available", "deleted"]], builder))
				.toStrictEqual("#status_0 IN (:available_0, :deleted_0)")
			expect(builder.attributeNames).toStrictEqual({ "#status_0": "status" })
			expect(builder.attributeValues).toStrictEqual({ ":available_0": "available", ":deleted_0": "deleted" })
		})
		test("number", () => {
			const builder: ExpressionBuilder = new ExpressionBuilder()
			expect(getDynamoDbConditionExpressionString(["id", "in", [3333, 4444, 5555]], builder))
				.toStrictEqual("#id_0 IN (:A3333_0, :A4444_0, :A5555_0)")
			expect(builder.attributeNames).toStrictEqual({ "#id_0": "id" })
			expect(builder.attributeValues).toStrictEqual({ ":A3333_0": 3333, ":A4444_0": 4444, ":A5555_0": 5555 })
		})
	})
	describe("=", () => {
		test("string", () => {
			const builder: ExpressionBuilder = new ExpressionBuilder()
			expect(getDynamoDbConditionExpressionString(["id", "=", "abcd"], builder))
				.toStrictEqual("#id_0 = :abcd_0")
			expect(builder.attributeNames).toStrictEqual({ "#id_0": "id" })
			expect(builder.attributeValues).toStrictEqual({ ":abcd_0": "abcd" })
		})
		test("number", () => {
			const builder: ExpressionBuilder = new ExpressionBuilder()
			expect(getDynamoDbConditionExpressionString(["updatedAt", "=", 0], builder))
				.toStrictEqual("#updatedAt_0 = :A0_0")
			expect(builder.attributeNames).toStrictEqual({ "#updatedAt_0": "updatedAt" })
			expect(builder.attributeValues).toStrictEqual({ ":A0_0": 0 })
		})
	})
	describe("!=", () => {
		test("string", () => {
			for (const neq of ["!=", "<>"]) {
				const builder: ExpressionBuilder = new ExpressionBuilder()
				expect(getDynamoDbConditionExpressionString(["id", neq as "!=" | "<>", "abcd"], builder))
					.toStrictEqual("#id_0 <> :abcd_0")
				expect(builder.attributeNames).toStrictEqual({ "#id_0": "id" })
				expect(builder.attributeValues).toStrictEqual({ ":abcd_0": "abcd" })
			}
		})
	})
	test("begins with", () => {
		const builder: ExpressionBuilder = new ExpressionBuilder()
		expect(getDynamoDbConditionExpressionString(["name", "begins with", "P"], builder))
			.toStrictEqual("begins_with(#name_0, :P_0)")
		expect(builder.attributeNames).toStrictEqual({ "#name_0": "name" })
		expect(builder.attributeValues).toStrictEqual({ ":P_0": "P" })
	})
	describe("between", () => {
		test("string", () => {
			const builder: ExpressionBuilder = new ExpressionBuilder()
			expect(getDynamoDbConditionExpressionString(["id", "between", "0000", "and", "1000"], builder))
				.toStrictEqual("#id_0 BETWEEN :A0000_0 AND :A1000_0")
			expect(builder.attributeNames).toStrictEqual({ "#id_0": "id" })
			expect(builder.attributeValues).toStrictEqual({ ":A0000_0": "0000", ":A1000_0": "1000" })
		})
		test("number", () => {
			const builder: ExpressionBuilder = new ExpressionBuilder()
			expect(getDynamoDbConditionExpressionString(["updatedAt", "between", 1701653045499, "and", 1701653055480], builder))
				.toStrictEqual("#updatedAt_0 BETWEEN :A1701653045499_0 AND :A1701653055480_0")
			expect(builder.attributeNames).toStrictEqual({ "#updatedAt_0": "updatedAt" })
			expect(builder.attributeValues).toStrictEqual({ ":A1701653045499_0": 1701653045499, ":A1701653055480_0": 1701653055480 })
		})
	})
})
