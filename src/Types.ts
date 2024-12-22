import * as z from "zod"
import { plurality } from "./Utilities"
import { Table } from "./classes/Table"

export type AnyToNever<T> = [T] extends [any] ? (unknown extends T ? never : T) : T

type UnionKeys<T> = T extends T ? keyof T : never
export type MergeUnion<T> = {
	[K in UnionKeys<T>]: T extends Record<K, infer V> ? V : never
}

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

export type FilterConditionLeaf<L, R> = [L, "exists" | "doesn't exist"] | (R extends string ? (
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

/** Type representing a condition for filtering items during a query or scan. */
export type FilterCondition<I extends Record<string, any>> = {[K in keyof I]: FilterConditionLeaf<K, I[K]>}[keyof I] | [FilterCondition<I>, "or", FilterCondition<I>] | [FilterCondition<I>, "and", FilterCondition<I>] | [FilterCondition<I>]

/** @hidden */
export type ConditionCondition<L, R> = [L, "=", R] | [L, "exists" | "doesn't exist"]

/** Type representing the nature of a relationship between two Tables */
export enum TableRelationshipType {
	/**
	 * There is a 1:1 coupling between each item in this Table and the peer Table.
	 * 
	 * Items of each Table have a string or number attribute which identifies its coupled item in the other Table.
	 */
	ONE_TO_ONE = "ONE_TO_ONE",
	/**
	 * Items in this Table are coupled to any number of items in the peer Table.
	 * 
	 * Items of this Table have an array attribute which identifies its coupled items in the peer Table. Items of the
	 * peer Table have a string or number attribute which identifies its coupled item in this Table.
	 */
	ONE_TO_MANY = "ONE_TO_MANY",
	/**
	 * Items in this Table are coupled to one item in the peer Table.
	 * 
	 * Items in the peer Table map to any number of items in this Table. Items of this Table have a string or number
	 * attribute which identifies its coupled item in the peer Table. Items of the peer Table have an array attribute
	 * which identifies its coupled items in this Table. 
	 */
	MANY_TO_ONE = "MANY_TO_ONE",
	/**
	 * Items in this Table are coupled to any number of items in the peer Table, and vice versa.
	 * 
	 * Items of each Table have an array attribute which identifies its coupled items in the other Table.
	 */
	MANY_TO_MANY = "MANY_TO_MANY"
}

/** @hidden */
export type FlipTableRelationshipType<RT> =
	RT extends TableRelationshipType.ONE_TO_MANY ? TableRelationshipType.MANY_TO_ONE :
	RT extends TableRelationshipType.MANY_TO_ONE ? TableRelationshipType.ONE_TO_MANY :
	RT

/** @hidden */
export type TableRelationship<RT extends TableRelationshipType> = {
	type: RT,
	peerTable: Table<any, any, any>,
	itemForeignKeys: (item: any) => TableRelationshipForeignKeyPlurality<RT, Record<string, any>>,
	peerItemForeignKeys: (item: any) => TableRelationshipForeignKeyPlurality<FlipTableRelationshipType<RT>, Record<string, any>>,
	itemExemption?: (item: any) => boolean,
	peerItemExemption?: (item: any) => boolean
}

/** @hidden */
export type TableRelationshipForeignKeyPlurality<RT, T> = RT extends (TableRelationshipType.ONE_TO_ONE | TableRelationshipType.MANY_TO_ONE) ? (
	T
) : (
	Array<T>
)

/**
 * Error for when OptimusDdbClient is unable to get DynamoDB to process one or more
 * keys while it is calling BatchGetItem. ends with unprocessedKeys. DynamoDB doesn't
 * specify the reason for the items being unprocessed. Please see [the DynamoDB BatchGetItem documentation
 * ](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html) for why
 * that may happen.
 * 
 * OptimusDdbClient's retry strategy for BatchGetItem is to keep calling with up to 100 keys
 * at a time until either it gets everything it needs or there's a call where every key
 * it asks for comes back in UnproccessedKeys.
 */
export class UnprocessedKeysError extends Error {
	name = "ItemNotFoundError"
	readonly unprocessedKeys: Array<Record<string,any>>
	constructor(params: { unprocessedKeys: Array<Record<string,any>> }) {
		super(`Error processing ${params.unprocessedKeys.length} keys.`)
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
 * Error for when OptimusDdbClient is given an invalid resumeKey.
 */
export class InvalidResumeKeyError extends Error {
	name = "InvalidResumeKeyError"
	constructor() {
		super("Invalid resumeKey.")
	}
}

/**
 * Error for when OptimusDdbClient encounters an item that does not match its Table's `itemSchema`.
 */
export class ItemValidationError extends Error {
	name = "ItemValidationError"
	issues: Array<z.ZodIssue>
	constructor(zodError: z.ZodError) {
		super(zodError.message)
		this.issues = zodError.issues
	}
}

/**
 * Error for when OptimusDdbClient `commitItems`' items violate a Table relationship.
 */
export class TableRelationshipViolationError extends Error {
	name = "TableRelationshipViolationError"
	constructor(params: {
		/** Item triggering the Table relationship violation. */
		item: Record<string, any>,
		/** The type of the TableRelationship. */
		tableRelationshipType: TableRelationshipType,
		/** The tables of the TableRelationship. */
		tables: [Table<any, any, any>, Table<any, any, any>]
	}) {
		super(`Item violates ${params.tableRelationshipType} relationship between ${params.tables.map(table => table.tableName).join(" and ")
			}: ${JSON.stringify(params.item)}`)
	}
}

/**
 * Error when trying to add a Table relationship which already exists.
 */
export class TableRelationshipAlreadyExistsError extends Error {
	name = "TableRelationshipAlreadyExistsError"
	constructor() {
		super("The Table relationship already exists.")
	}
}

/**
 * Error for when an item has no version attribute.
 */
export class ItemWithoutVersionError extends Error {
	name = "ItemWithoutVersionError"
	constructor(message: string) {
		super(message)
	}
}

/** @hidden */
export type PerKeyItemChange = {
	table: Table<any,any,any>,
	key: Record<string, any>,
	existingDdbItemVersion: number | undefined,
	oldItem: Record<string, any> | undefined,
	newItem: Record<string, any> | undefined
}

export type NonStripZodObject = z.ZodObject<any, "strict" | "passthrough">

export type OneOrArray<T> = T | Array<T>