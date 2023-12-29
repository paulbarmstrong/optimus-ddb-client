import { ObjectShape } from "shape-tape"
import { ShapeDictionary } from "../Types"

export class Table<I extends ShapeDictionary, P extends keyof I, S extends keyof I = never> {
	readonly tableName: string
	readonly itemShape: ObjectShape<I>
	readonly partitionKey: P
	readonly sortKey?: S
	readonly attributes: Array<keyof I>
	readonly keyAttributes: Array<string>
	readonly versionAttribute: string
	constructor(params: {
		tableName: string,
		itemShape: ObjectShape<I>,
		partitionKey: P,
		sortKey?: S,
		versionAttribute?: string
	}) {
		this.tableName = params.tableName
		this.itemShape = params.itemShape
		this.partitionKey = params.partitionKey
		this.sortKey = params.sortKey
		this.attributes = Object.keys(params.itemShape.object)
		this.keyAttributes = [
			this.partitionKey as string,
			...(this.sortKey !== undefined ? [this.sortKey as string] : [])
		]
		this.versionAttribute = params.versionAttribute !== undefined ? params.versionAttribute.toString() : "version"
		Object.keys(this.itemShape.object).forEach(attributeName => {
			if (attributeName === this.versionAttribute) {
				throw new Error(`${this.tableName
					} table's item shape includes reserved version attribute "${
					this.versionAttribute.toString()}".`
				)
			}
		})
	}
}
