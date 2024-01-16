import { AnyToNever, MergeUnion } from "../src/Types"

type AssertEqual<A, B> = [A] extends [never] ? (
	[B] extends [never] ? true : false
) : (
	B extends A ? (A extends B ? true : false) : false
)

describe("AnyToNever", () => {
	test("any", () => {
		const assertion: AssertEqual<AnyToNever<any>, never> = true
	})
	test("other stuff", () => {
		const assertion: AssertEqual<AnyToNever<{ id: string }>, { id: string }> = true
	})
})

describe("MergeUnion", () => {
	test("regular case", () => {
		const assertion: AssertEqual<
			MergeUnion<{ id: string, name: string } | { id: string, timestamp: number }>,
			{ id: string, name: string, timestamp: number }
		> = true
	})
	test("with differing types for the same property", () => {
		const assertion: AssertEqual<
		MergeUnion<{ id: string, type: "comment" } | { id: string, type: "title" }>,
			{ id: string, type: "comment" | "title" }
		> = true
	})
})