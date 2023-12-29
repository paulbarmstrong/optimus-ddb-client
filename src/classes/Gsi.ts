import { ShapeDictionary } from "../Types"
import { Table } from "./Table"

export class Gsi<I extends ShapeDictionary, P extends keyof I, S extends keyof I = never> {
	table: Table<I,any,any>
	indexName: string
	partitionKey: P
	sortKey?: S
	constructor(params: {
		table: Table<I,any,any>,
		indexName: string,
		partitionKey: P,
		sortKey?: S
	}) {
		this.table = params.table
		this.indexName = params.indexName
		this.partitionKey = params.partitionKey
		this.sortKey = params.sortKey
	}
}
