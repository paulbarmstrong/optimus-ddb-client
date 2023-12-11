import { ShapeDictionary } from "../Types"
import { Table } from "./Table"

export class Gsi<I extends ShapeDictionary, P extends keyof I, S extends keyof I = never> {
	table: Table<I,any,any>
	indexName: string
	partitionKey: P
	sortKey?: S
	constructor(props: {
		table: Table<I,any,any>,
		indexName: string,
		partitionKey: P,
		sortKey?: S
	}) {
		this.table = props.table
		this.indexName = props.indexName
		this.partitionKey = props.partitionKey
		this.sortKey = props.sortKey
	}
}
