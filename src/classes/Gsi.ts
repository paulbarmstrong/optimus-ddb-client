import * as z from "zod"
import { Table } from "./Table"
import { MergeUnion, NonStripZodObject } from "../Types"

/**
 * Gsi represents a DynamoDB Global Secondary Index (GSI). It can be created once and then
 * provided to OptimusDdbClient when doing query and scan operations.
 */
export class Gsi<I extends NonStripZodObject | z.ZodUnion<[NonStripZodObject, ...NonStripZodObject[]]>, P extends keyof MergeUnion<z.infer<I>>, S extends keyof MergeUnion<z.infer<I>> = never> {
	/** The Table class instance representing the DynamoDB table of the GSI. */
	table: Table<I,any,any>
	/** The IndexName of the GSI. */
	indexName: string
	/** The name of the GSI's partition key. */
	partitionKey: P
	/** The name of the GSI's sort key or `undefined` if it has no sort key. */
	sortKey?: S
	constructor(params: {
		/** The Table class instance representing the DynamoDB table of the GSI. */
		table: Table<I,any,any>,
		/** The IndexName of the GSI. */
		indexName: string,
		/** The name of the GSI's partition key. */
		partitionKey: P,
		/** The name of the GSI's sort key. It must be provided if and only if the GSI has a sort key. */
		sortKey?: S
	}) {
		this.table = params.table
		this.indexName = params.indexName
		this.partitionKey = params.partitionKey
		this.sortKey = params.sortKey
	}
}
