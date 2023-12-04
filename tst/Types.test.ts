import { AnyToNever } from "../src/Types"

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
