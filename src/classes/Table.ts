import { ObjectShape, ShapeToType, UnionShape } from "shape-tape"

/**
 * Table represents a DynamoDB Table. It can be created once and then provided to OptimusDdbClient
 * when doing operations on items.
 * 
 * #### Regarding `itemShape`
 * 
 * The `itemShape` constructor parameter is a Shape representing the structure of items in the table. The Shape
 * should be an ObjectShape (or UnionShape of ObjectShapes) including all attributes except for the version attribute which is abstracted from 
 * OptimusDdbClient consumers.
 * 
 * The mappings between DynamoDB types and Shapes are as follows:
 * 
 * |DynamoDB Type|Shape class|Shape creation example|
 * |-------------|-----------|-------|
 * |S            |StringShape|`s.string()`|
 * |N            |NumberShape|`s.number()`|
 * |BOOL         |BooleanShape|`s.number()`|
 * |B            |ClassShape\<Uint8Array\>|`s.class(Uint8Array)`|
 * |M            |ObjectShape|`s.object({})`|
 * |L            |ArrayShape|`s.array(s.string())`|
 * |NULL         |LiteralShape\<null\>|`s.literal(null)`|
 * |(Absent Attribute)|LiteralShape\<undefined\>|`s.literal(undefined)`|
 * 
 * An item Shape for a table with items having S attributes "id" and "text" (and N attribute "version" for optimistic 
 * locking) might be:
 * 
 * ```
 * s.object({ id: s.string(), text: s.string() })
 * ```
 * 
 * Please see the shape-tape documentation for more details about creating shapes.
 * 
 */
export class Table<I extends ObjectShape<any> | UnionShape<Array<ObjectShape<any>>>, P extends keyof ShapeToType<I>, S extends keyof ShapeToType<I> = never> {
	/** The name of the DynamoDB table. */
	readonly tableName: string
	/** Shape representing the structure of items in the table. Please see the Table class documentation for details. */
	readonly itemShape: I
	/** The name of the DynamoDB table's partition key. */
	readonly partitionKey: P
	/** The name of the DynamoDB table's sort key or `undefined` if it has no sort key. */
	readonly sortKey?: S
	/** The names of all of the item attributes (except for the version attribute). */
	readonly attributes: Array<string>
	/** 
	 * The names of all of the key attributes. It will contain either 1 or 2 items depending on
	 * if the table has a sort key.
	 */
	readonly keyAttributes: Array<string>
	/** The name of the version attribute used for optimistic locking. */
	readonly versionAttribute: string
	constructor(params: {
		/** The TableName of the DynamoDB table. */
		tableName: string,
		/** Shape representing the structure of items in the table. Please see the Table class documentation for details. */
		itemShape: I,
		/** The name of the DynamoDB table's partition key. */
		partitionKey: P,
		/**
		 * The name of the DynamoDB table's sort key.
		 * It must be provided if and only if the table has a sort key.
		 */
		sortKey?: S,
		/** The name of the N attribute to be used for optimistic locking. The default is "version". */
		versionAttribute?: string
	}) {
		this.tableName = params.tableName
		this.itemShape = params.itemShape
		this.partitionKey = params.partitionKey
		this.sortKey = params.sortKey
		if ((params.itemShape as ObjectShape<any>).propertyShapes !== undefined) {
			this.attributes = Object.keys((params.itemShape as ObjectShape<any>).propertyShapes)
		} else {
			const attributesNotUnique = (params.itemShape as UnionShape<Array<ObjectShape<any>>>)
				.memberShapes.map(x => Object.keys(x.propertyShapes)).flat()
			this.attributes = [...new Set(attributesNotUnique)]
		}
		this.keyAttributes = [
			this.partitionKey as string,
			...(this.sortKey !== undefined ? [this.sortKey as string] : [])
		]
		this.versionAttribute = params.versionAttribute !== undefined ? params.versionAttribute.toString() : "version"
		this.attributes.forEach(attributeName => {
			if (attributeName === this.versionAttribute) {
				throw new Error(`${this.tableName
					} table's item shape includes reserved version attribute "${
					this.versionAttribute.toString()}".`
				)
			}
		})
	}
}
