import { DictionaryShape } from "shape-tape"
import { ShapeDictionary } from "../Types"

export class Table<I extends ShapeDictionary, P extends keyof I, S extends keyof I = never> {
	tableName: string
	itemShape: DictionaryShape<I>
	partitionKey: P
	sortKey?: S
	attributes: Array<keyof I>
	keyAttributes: Array<string>
	constructor(params: {
		tableName: string,
		itemShape: DictionaryShape<I>,
		partitionKey: P,
		sortKey?: S
	}) {
		this.tableName = params.tableName
		this.itemShape = params.itemShape
		this.partitionKey = params.partitionKey
		this.sortKey = params.sortKey
		this.attributes = Object.keys(params.itemShape.dictionary)
		this.keyAttributes = [
			this.partitionKey as string,
			...(this.sortKey !== undefined ? [this.sortKey as string] : [])
		]
		Object.keys(this.itemShape.dictionary).forEach(attributeName => {
			if (attributeName === "version") {
				throw new Error(`${this.tableName} table's item shape includes reserved attribute name "version".`)
			}
		})
	}
}
