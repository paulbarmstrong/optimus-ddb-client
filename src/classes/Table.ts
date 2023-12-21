import { DictionaryShape } from "shape-tape"
import { ShapeDictionary } from "../Types"

export class Table<I extends ShapeDictionary, P extends keyof I, S extends keyof I = never> {
	table = this
	tableName: string
	itemShape: DictionaryShape<I>
	partitionKey: P
	sortKey?: S
	attributes: Array<keyof I>
	keyAttributes: Array<string>
	constructor(props: {
		tableName: string,
		itemShape: DictionaryShape<I>,
		partitionKey: P,
		sortKey?: S
	}) {
		this.tableName = props.tableName
		this.itemShape = props.itemShape
		this.partitionKey = props.partitionKey
		this.sortKey = props.sortKey
		this.attributes = Object.keys(props.itemShape.dictionary)
		this.keyAttributes = [
			this.partitionKey as string,
			...(this.sortKey !== undefined ? [this.sortKey as string] : [])
		]
	}
}
