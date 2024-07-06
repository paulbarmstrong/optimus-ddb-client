import { ObjectShape, ShapeToType, UnionShape } from "shape-tape"
import { flipRelationshipType } from "../Utilities"
import { DEFAULT_RELATIONSHIP_COMPOSITE_KEY_SEPARATOR } from "../Constants"
import { FlipTableRelationshipType, TableRelationship, TableRelationshipAlreadyExistsError, TableRelationshipType,
	TableRelationshipTypeToAttType } from "../Types"

/**
 * Table represents a DynamoDB Table. It can be created once and then provided to OptimusDdbClient
 * when doing operations on items.
 * 
 * #### Regarding `itemShape`
 * 
 * The `itemShape` constructor parameter is a Shape representing the structure of items in the table. The Shape
 * should be an ObjectShape (or UnionShape of ObjectShapes) including all attributes except for the version
 * attribute which is abstracted from OptimusDdbClient consumers.
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
export class Table<I extends ObjectShape<any, any> | UnionShape<Array<ObjectShape<any,any>>>, P extends keyof ShapeToType<I>, S extends keyof ShapeToType<I> = never> {
	/** @hidden */
	#relationships: Array<TableRelationship>
	/** The name of the DynamoDB table. */
	readonly tableName: string
	/** Shape representing the structure of items in the table. Please see the Table class documentation for details. */
	readonly itemShape: I
	/** The name of the DynamoDB table's partition key. */
	readonly partitionKey: P
	/** The name of the DynamoDB table's sort key or `undefined` if it has no sort key. */
	readonly sortKey?: S
	/** The names of all of the item attributes (except for the version attribute). */
	readonly attributeNames: Array<string>
	/** 
	 * The names of all of the key attributes. It will contain either 1 or 2 items depending on
	 * if the table has a sort key.
	 */
	readonly keyAttributeNames: Array<string>
	/** The name of the version attribute used for optimistic locking. */
	readonly versionAttributeName: string
	constructor(params: {
		/** The TableName of the DynamoDB table. */
		tableName: string,
		/** Shape representing the structure of items in the table. Please see the top-level Table class documentation for details. */
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
		this.#relationships = []
		this.tableName = params.tableName
		this.itemShape = params.itemShape
		this.partitionKey = params.partitionKey
		this.sortKey = params.sortKey
		if ((params.itemShape as ObjectShape<any,any>).propertyShapes !== undefined) {
			this.attributeNames = Object.keys((params.itemShape as ObjectShape<any,any>).propertyShapes)
		} else {
			const attributeNamesNotUnique = (params.itemShape as UnionShape<Array<ObjectShape<any,any>>>)
				.memberShapes.map(x => Object.keys(x.propertyShapes)).flat()
			this.attributeNames = [...new Set(attributeNamesNotUnique)]
		}
		this.keyAttributeNames = [
			this.partitionKey as string,
			...(this.sortKey !== undefined ? [this.sortKey as string] : [])
		]
		this.versionAttributeName = params.versionAttribute !== undefined ? params.versionAttribute.toString() : "version"
		this.attributeNames.forEach(attributeName => {
			if (attributeName === this.versionAttributeName) {
				throw new Error(`${this.tableName
					} table's item shape includes reserved version attribute "${
					this.versionAttributeName.toString()}".`
				)
			}
		})
	}

	/**
	 * Add a relationship to the Table. Table relationships are enforced upon OptimusDdbClient's `commitItems`.
	 */
	addRelationship<
		RT extends TableRelationshipType,
		PointerAttributeName extends { [K in keyof ShapeToType<I>]: (K extends P | S ? never : ShapeToType<I>[K] extends TableRelationshipTypeToAttType<RT> ? K : never) }[keyof ShapeToType<I>],
		I1 extends ObjectShape<any, any> | UnionShape<Array<ObjectShape<any,any>>>,
		P1 extends keyof ShapeToType<I1>,
		S1 extends keyof ShapeToType<I1>,
		PeerPointerAttributeName extends { [K in keyof ShapeToType<I1>]: (K extends P1 | S1 ? never : ShapeToType<I1>[K] extends TableRelationshipTypeToAttType<FlipTableRelationshipType<RT>> ? K : never) }[keyof ShapeToType<I1>]
	>(params: {
		/** The nature of the table relationship. */
		type: RT,
		/** The attribute on this Table which points to items of the peer Table. */
		pointerAttributeName: PointerAttributeName,
		/** The other Table in the relationship. */
		peerTable: Table<I1, P1, S1>,
		/** The attribute on the peer Table which points to items of this Table. */
		peerPointerAttributeName: PeerPointerAttributeName,
		/** The separator used to join the partition key and sort key when one of the Tables has a sort key. */
		compositeKeySeparator?: string,
		/** Predicate for when an item should be exempted from the relationship. */
		itemExemption?: (item: ShapeToType<I>) => boolean,
		/** Predicate for when an item from the peer Table should be exempted from the relationship. */
		peerItemExemption?: (item: ShapeToType<I1>) => boolean
	}) {
		if (this.#relationships.find(relationship => relationship.peerTable === params.peerTable
				&& relationship.pointerAttributeName === params.pointerAttributeName) !== undefined) {
			throw new TableRelationshipAlreadyExistsError()
		}
		this.#relationships.push({
			type: params.type,
			pointerAttributeName: params.pointerAttributeName as unknown as string,
			peerTable: params.peerTable,
			peerPointerAttributeName: params.peerPointerAttributeName as unknown as string,
			compositeKeySeparator: params.compositeKeySeparator ?? DEFAULT_RELATIONSHIP_COMPOSITE_KEY_SEPARATOR,
			itemExemption: params.itemExemption,
			peerItemExemption: params.peerItemExemption
		})
		try {
			params.peerTable.addRelationship({
				type: flipRelationshipType(params.type),
				pointerAttributeName: params.peerPointerAttributeName as any,
				peerTable: this,
				peerPointerAttributeName: params.pointerAttributeName as any,
				compositeKeySeparator: params.compositeKeySeparator,
				itemExemption: params.peerItemExemption,
				peerItemExemption: params.itemExemption
			})
		} catch (error) {
			if ((error as Error).name !== "TableRelationshipAlreadyExistsError") throw error
		}
	}

	/** 
	 * The relationships that are applied to the Table. For each relationship, the peer Table has a
	 * corresponding inverted relationship to this Table.
	 */
	get relationships() {
		return [...this.#relationships]
	}
}
