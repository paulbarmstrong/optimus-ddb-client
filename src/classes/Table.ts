import * as z from "zod"
import { flipRelationshipType } from "../Utilities"
import { FlipTableRelationshipType, NonStripZodObject, TableRelationship, TableRelationshipForeignKeyPlurality,
	TableRelationshipType } from "../Types"

/**
 * Table represents a DynamoDB Table. It can be created once and then provided to OptimusDdbClient
 * when doing operations on items.
 * 
 * #### Regarding `itemSchema`
 * 
 * The `itemSchema` constructor parameter is a [zod](https://www.npmjs.com/package/zod) schema object
 * representing the structure of items in the table. The schema should be a ZodObject (or ZodUnion of
 * ZodObjects) including all attributes except for the version attribute which is abstracted from
 * OptimusDdbClient consumers. The ZodObject must be "strict" or "passthrough".
 * 
 * The mappings between DynamoDB types and zod schema are as follows:
 * 
 * |DynamoDB Type|Zod schema class|Zod schema creation example|
 * |-------------|-----------|-------|
 * |S            |ZodString|`z.string()`|
 * |N            |ZodNumber|`z.number()`|
 * |BOOL         |ZodBoolean|`z.boolean()`|
 * |B            |ZodType\<Uint8Array\>|`z.instanceOf(Uint8Array)`|
 * |M            |ZodObject|`z.strictObject({})`|
 * |L            |ZodArray|`z.array(z.string())`|
 * |NULL         |ZodNull|`z.null()`|
 * |(Absent Attribute)|ZodUndefined|`z.undefined()`|
 * 
 * An itemSchema for a table with items having S attributes "id" and "text" (and N attribute "version"
 * for optimistic locking) might be:
 * 
 * ```
 * z.strictObject({ id: z.string(), text: z.string() })
 * ```
 * 
 * Please see [zod](https://www.npmjs.com/package/zod) for more details about creating itemSchema.
 * 
 */

export class Table<I extends NonStripZodObject | z.ZodUnion<[NonStripZodObject, ...NonStripZodObject[]]>, P extends keyof z.infer<I>, S extends keyof z.infer<I> = never> {
	/** @hidden */
	#relationships: Array<TableRelationship<any>>
	/** The name of the DynamoDB table. */
	readonly tableName: string
	/** Zod schema representing the structure of items in the table. Please see the Table class documentation for details. */
	readonly itemSchema: I
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
		/** Zod schema representing the structure of items in the table. Please see the Table class documentation for details. */
		itemSchema: I,
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
		this.itemSchema = params.itemSchema
		this.partitionKey = params.partitionKey
		this.sortKey = params.sortKey
		if ((params.itemSchema as z.ZodObject<any>).shape !== undefined) {
			this.attributeNames = Object.keys((params.itemSchema as z.ZodObject<any>).shape)
		} else {
			const attributeNamesNotUnique = (params.itemSchema as z.ZodUnion<[z.ZodObject<any>, ...z.ZodObject<any>[]]>)
				.options.map(x => Object.keys(x.shape)).flat()
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
					} table's itemSchema includes reserved version attribute "${
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
		I1 extends NonStripZodObject | z.ZodUnion<[NonStripZodObject, ...NonStripZodObject[]]>,
		P1 extends keyof z.infer<I1>,
		S1 extends keyof z.infer<I1>
	>(params: {
		/** The nature of the table relationship. */
		type: RT,
		/** The other Table in the relationship. */
		peerTable: Table<I1, P1, S1>,
		/** Function for producing the current foreign keys of a given item. */
		itemForeignKeys: (item: z.infer<I>) => TableRelationshipForeignKeyPlurality<RT, { [T1 in P1]: z.infer<I1>[P1] } & { [T1 in S1]: z.infer<I1>[S1] }>,
		/** Function for producing the current foreign keys of a given peer item. */
		peerItemForeignKeys: (item: z.infer<I1>) => TableRelationshipForeignKeyPlurality<FlipTableRelationshipType<RT>, { [T in P]: z.infer<I>[P] } & { [T in S]: z.infer<I>[S] }>,
		/** Predicate for when an item should be exempted from the relationship. */
		itemExemption?: (item: z.infer<I>) => boolean,
		/** Predicate for when an item from the peer Table should be exempted from the relationship. */
		peerItemExemption?: (item: z.infer<I1>) => boolean
	}) {
		this.#relationships.push({
			type: params.type,
			peerTable: params.peerTable,
			itemForeignKeys: params.itemForeignKeys,
			peerItemForeignKeys: params.peerItemForeignKeys,
			itemExemption: params.itemExemption,
			peerItemExemption: params.peerItemExemption
		})
		try {
			params.peerTable._addRelationshipAux({
				type: flipRelationshipType(params.type),
				peerTable: this,
				itemForeignKeys: params.peerItemForeignKeys,
				peerItemForeignKeys: params.itemForeignKeys,
				itemExemption: params.peerItemExemption,
				peerItemExemption: params.itemExemption
			})
		} catch (error) {
			if ((error as Error).name !== "TableRelationshipAlreadyExistsError") throw error
		}
	}

	/** @hidden */
	_addRelationshipAux(relationship: TableRelationship<any>) {
		this.#relationships.push(relationship)
	}

	/** 
	 * The relationships that are applied to the Table. For each relationship, the peer Table has a
	 * corresponding inverted relationship to this Table.
	 */
	get relationships() {
		return [...this.#relationships]
	}
}
