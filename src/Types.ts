import { ObjectShape, Shape, ShapeToType, ShapeValidationError } from "shape-tape"
import { plurality } from "./Utilities"

/** Type alias for a Shape's object parameter. */
export type ShapeObject = { [key: string]: Shape }
/** Utility Type for getting the TypeScript type that a ObjectShape's Shape represents. */
export type ShapeObjectToType<S extends ShapeObject> = ShapeToType<ObjectShape<S>>

export type AnyToNever<T> = [T] extends [any] ? (unknown extends T ? never : T) : T

/** Type representing a condition that specifies a partition. */
export type PartitionKeyCondition<L,R> = [L, "=", R]

/** Type representing a condition that specifies how a partition is queried. */
export type SortKeyCondition<L, R> = R extends string ? (
	[L, "=", R] | 
	[L, "<" | ">" | "<=" | ">=" | "begins with", string] | [L, "between", string, "and", string]
) : R extends Uint8Array ? (
	[L, "=", R] | 
	[L, "<" | ">" | "<=" | ">=" | "begins with", Uint8Array] | [L, "between", Uint8Array, "and", Uint8Array]
) : (
	[L, "=" | "<" | ">" | "<=" | ">=", R] | [L, "between", R, "and", R]
)

/** Type representing a condition for filtering query or scan results. */
export type FilterCondition<L, R> = [L, "exists" | "doesn't exist"] | (R extends string ? (
	[L, "=", R] |
	[L, "<>" | "!=" | "<" | ">" | "<=" | ">=" | "begins with" | "contains", string] |
	[L, "between", string, "and", string] |
	[L, "in", Array<R>]
) : R extends number | Uint8Array ? (
	[L, "=" | "<>" | "!=" | "<" | ">" | "<=" | ">=", R] |
	[L, "between", R, "and", R] |
	[L, "in", Array<R>]
) : R extends Array<any> ? (
	[L, "contains", any]
) : (
	[L, "=", R]
))

export type ConditionCondition<L, R> = [L, "=", R] | [L, "exists" | "doesn't exist"]

/**
 * Error for when OptimusDdbClient's `getItems` ends with unprocessedKeys. Please see [the DynamoDB
 * documentation](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html)
 * for why that may happen.
 */
export class UnprocessedKeysError extends Error {
	name = "ItemNotFoundError"
	readonly unprocessedKeys: Array<Record<string,any>>
	constructor(params: { unprocessedKeys: Array<Record<string,any>> }) {
		super(`Error processing ${params.unprocessedKeys} keys.`)
		this.unprocessedKeys = params.unprocessedKeys
	}
}

/**
 * Error for when item(s) are not found. It means that item(s) did not exist in the index when
 * OptimusDdbClient's `getItem` or `getItems` was called.
 */
export class ItemNotFoundError extends Error {
	name = "ItemNotFoundError"
	/** The keys of the item(s) that were not found. */
	readonly itemKeys: Array<Record<string,any>>
	constructor(params: {
		/** The keys of the item(s) that were not found. */
		itemKeys: Array<Record<string,any>>
	}) {
		super(`${params.itemKeys.length} item${plurality(params.itemKeys.length)} not found.`)
		this.itemKeys = params.itemKeys
	}
}

/**
 * Error for when OptimusDdbClient `commitItem`'s transaction is cancelled due to a conditional check failure.
 */
export class OptimisticLockError extends Error {
	name = "OptimisticLockError"
	constructor() {
		super("Optimistic lock error.")
	}
}

/**
 * Error for when OptimusDdbClient is given an invalid nextToken.
 */
export class InvalidNextTokenError extends Error {
	name = "InvalidNextTokenError"
	constructor() {
		super("Invalid nextToken.")
	}
}

/**
 * Error for when OptimusDdbClient encounters an item that does not match its Table's `itemShape`.
 */
export class ItemShapeValidationError extends ShapeValidationError {
	name = "ItemShapeValidationError"
	constructor(params: ConstructorParameters<typeof ShapeValidationError>[0]) {
		super(params)
	}
}