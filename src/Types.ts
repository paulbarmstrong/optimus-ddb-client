import { Shape, ShapeToType, ShapeValidationError } from "shape-tape"
import { plurality } from "./Utilities"

export type ShapeDictionary = { [key: string]: Shape }
export type AnyToNever<T> = [T] extends [any] ? (unknown extends T ? never : T) : T

export type PartitionKeyCondition<L,R> = [L, "=", R]

export type FilterConditionsFor<I extends ShapeDictionary, P extends keyof I, S extends keyof I> = {
	[K in Exclude<Exclude<keyof I, P>, S>]: FilterCondition<K, ShapeToType<I[K]>>
}[Exclude<Exclude<keyof I, P>, S>];

export type SortKeyCondition<L, R> = R extends string ? (
	[L, "=", R] | 
	[L, "<" | ">" | "<=" | ">=" | "begins with", string] | [L, "between", string, "and", string]
) : R extends Uint8Array ? (
	[L, "=", R] | 
	[L, "<" | ">" | "<=" | ">=" | "begins with", Uint8Array] | [L, "between", Uint8Array, "and", Uint8Array]
) : (
	[L, "=" | "<" | ">" | "<=" | ">=", R] | [L, "between", R, "and", R]
)

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

export class UnprocessedKeysError extends Error {
	name = "ItemNotFoundError"
	readonly unprocessedKeys: Array<Record<string,any>>
	constructor(params: { unprocessedKeys: Array<Record<string,any>> }) {
		super(`Error processing ${params.unprocessedKeys} keys.`)
		this.unprocessedKeys = params.unprocessedKeys
	}
}

export class ItemNotFoundError extends Error {
	name = "ItemNotFoundError"
	readonly itemKeys: Array<Record<string,any>>
	constructor(params: { itemKeys: Array<Record<string,any>> }) {
		super(`${params.itemKeys.length} item${plurality(params.itemKeys.length)} not found.`)
		this.itemKeys = params.itemKeys
	}
}

export class OptimisticLockError extends Error {
	name = "OptimisticLockError"
	constructor() {
		super("Optimistic lock error.")
	}
}

export class InvalidNextTokenError extends Error {
	name = "InvalidNextTokenError"
	constructor() {
		super("Invalid nextToken.")
	}
}

export class ItemShapeValidationError extends ShapeValidationError {
	name = "ItemShapeValidationError"
	constructor(params: ConstructorParameters<typeof ShapeValidationError>[0]) {
		super(params)
	}
}