import { Shape, ShapeToType } from "shape-tape"

export type ShapeDictionary = { [key: string]: Shape }
export type AnyToNever<T> = [T] extends [any] ? (unknown extends T ? never : T) : T
export type ConditionalType<X, Y> = Y extends never ? never : X

export type PartitionKeyCondition<L,R> = [L, "=", R]

export type FilterConditionsFor<I extends ShapeDictionary> = {
	[K in keyof I]: FilterCondition<K, ShapeToType<I[K]>>
}[keyof I];

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
	unprocessedKeys: Array<Record<string,any>>
	constructor(unprocessedKeys: Array<Record<string,any>>) {
		super(`Error processing ${unprocessedKeys} keys.`)
		this.unprocessedKeys = unprocessedKeys
	}
}

export class ItemNotFoundError extends Error {
	key: Record<string,any>
	constructor(key: Record<string,any>) {
		super(`Item not found: ${JSON.stringify(key)}.`)
		this.key = key
	}
}

export class ItemsNotFoundError extends Error {
	keys: Array<Record<string,any>>
	constructor(keys: Array<Record<string,any>>) {
		super(`${keys.length} items not found.`)
		this.keys = keys
	}
}

export class OptimisticLockError extends Error {
	constructor(message = "Optimistic lock error.") {
		super(message)
	}
}