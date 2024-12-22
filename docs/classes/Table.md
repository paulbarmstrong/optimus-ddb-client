[optimus-ddb-client](../index.md) / Table

# Class: Table\<I, P, S\>

Table represents a DynamoDB Table. It can be created once and then provided to OptimusDdbClient
when doing operations on items.

#### Regarding `itemSchema`

The `itemSchema` constructor parameter is a [zod](https://www.npmjs.com/package/zod) schema object
representing the structure of items in the table. The schema should be a ZodObject (or ZodUnion of
ZodObjects) including all attributes except for the version attribute which is abstracted from
OptimusDdbClient consumers. The ZodObject must be "strict" or "passthrough".

The mappings between DynamoDB types and zod schema are as follows:

|DynamoDB Type|Zod schema class|Zod schema creation example|
|-------------|-----------|-------|
|S            |ZodString|`z.string()`|
|N            |ZodNumber|`z.number()`|
|BOOL         |ZodBoolean|`z.boolean()`|
|B            |ZodType\<Uint8Array\>|`z.instanceOf(Uint8Array)`|
|M            |ZodObject|`z.strictObject({})`|
|L            |ZodArray|`z.array(z.string())`|
|NULL         |ZodNull|`z.null()`|
|(Absent Attribute)|ZodUndefined|`z.undefined()`|

An itemSchema for a table with items having S attributes "id" and "text" (and N attribute "version"
for optimistic locking) might be:

```
z.strictObject({ id: z.string(), text: z.string() })
```

Please see [zod](https://www.npmjs.com/package/zod) for more details about creating itemSchema.

## Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `NonStripZodObject` \| `z.ZodUnion`\<[`NonStripZodObject`, ...NonStripZodObject[]]\> |
| `P` | extends keyof `z.infer`\<`I`\> |
| `S` | extends keyof `z.infer`\<`I`\> = `never` |

## Table of contents

### Constructors

- [constructor](Table.md#constructor)

### Properties

- [attributeNames](Table.md#attributenames)
- [itemSchema](Table.md#itemschema)
- [keyAttributeNames](Table.md#keyattributenames)
- [partitionKey](Table.md#partitionkey)
- [sortKey](Table.md#sortkey)
- [tableName](Table.md#tablename)
- [versionAttributeName](Table.md#versionattributename)

### Accessors

- [relationships](Table.md#relationships)

### Methods

- [addRelationship](Table.md#addrelationship)

## Constructors

### constructor

• **new Table**\<`I`, `P`, `S`\>(`params`): [`Table`](Table.md)\<`I`, `P`, `S`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `NonStripZodObject` \| `ZodUnion`\<[`NonStripZodObject`, ...NonStripZodObject[]]\> |
| `P` | extends `string` \| `number` \| `symbol` |
| `S` | extends `string` \| `number` \| `symbol` = `never` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.itemSchema` | `I` | Zod schema representing the structure of items in the table. Please see the Table class documentation for details. |
| `params.partitionKey` | `P` | The name of the DynamoDB table's partition key. |
| `params.sortKey?` | `S` | The name of the DynamoDB table's sort key. It must be provided if and only if the table has a sort key. |
| `params.tableName` | `string` | The TableName of the DynamoDB table. |
| `params.versionAttribute?` | `string` | The name of the N attribute to be used for optimistic locking. The default is "version". |

#### Returns

[`Table`](Table.md)\<`I`, `P`, `S`\>

#### Defined in

[src/classes/Table.ts:62](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L62)

## Properties

### attributeNames

• `Readonly` **attributeNames**: `string`[]

The names of all of the item attributes (except for the version attribute).

#### Defined in

[src/classes/Table.ts:54](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L54)

___

### itemSchema

• `Readonly` **itemSchema**: `I`

Zod schema representing the structure of items in the table. Please see the Table class documentation for details.

#### Defined in

[src/classes/Table.ts:48](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L48)

___

### keyAttributeNames

• `Readonly` **keyAttributeNames**: `string`[]

The names of all of the key attributes. It will contain either 1 or 2 items depending on
if the table has a sort key.

#### Defined in

[src/classes/Table.ts:59](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L59)

___

### partitionKey

• `Readonly` **partitionKey**: `P`

The name of the DynamoDB table's partition key.

#### Defined in

[src/classes/Table.ts:50](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L50)

___

### sortKey

• `Optional` `Readonly` **sortKey**: `S`

The name of the DynamoDB table's sort key or `undefined` if it has no sort key.

#### Defined in

[src/classes/Table.ts:52](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L52)

___

### tableName

• `Readonly` **tableName**: `string`

The name of the DynamoDB table.

#### Defined in

[src/classes/Table.ts:46](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L46)

___

### versionAttributeName

• `Readonly` **versionAttributeName**: `string`

The name of the version attribute used for optimistic locking.

#### Defined in

[src/classes/Table.ts:61](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L61)

## Accessors

### relationships

• `get` **relationships**(): `TableRelationship`[]

The relationships that are applied to the Table. For each relationship, the peer Table has a
corresponding inverted relationship to this Table.

#### Returns

`TableRelationship`[]

#### Defined in

[src/classes/Table.ts:162](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L162)

## Methods

### addRelationship

▸ **addRelationship**\<`RT`, `PointerAttributeName`, `I1`, `P1`, `S1`, `PeerPointerAttributeName`\>(`params`): `void`

Add a relationship to the Table. Table relationships are enforced upon OptimusDdbClient's `commitItems`.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `RT` | extends [`TableRelationshipType`](../enums/TableRelationshipType.md) |
| `PointerAttributeName` | extends `string` \| `number` \| `symbol` |
| `I1` | extends `NonStripZodObject` \| `ZodUnion`\<[`NonStripZodObject`, ...NonStripZodObject[]]\> |
| `P1` | extends `string` \| `number` \| `symbol` |
| `S1` | extends `string` \| `number` \| `symbol` |
| `PeerPointerAttributeName` | extends `string` \| `number` \| `symbol` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.compositeKeySeparator?` | `string` | The separator used to join the partition key and sort key when one of the Tables has a sort key. |
| `params.itemExemption?` | (`item`: `TypeOf`\<`I`\>) => `boolean` | Predicate for when an item should be exempted from the relationship. |
| `params.peerItemExemption?` | (`item`: `TypeOf`\<`I1`\>) => `boolean` | Predicate for when an item from the peer Table should be exempted from the relationship. |
| `params.peerPointerAttributeName` | `PeerPointerAttributeName` | The attribute on the peer Table which points to items of this Table. |
| `params.peerTable` | [`Table`](Table.md)\<`I1`, `P1`, `S1`\> | The other Table in the relationship. |
| `params.pointerAttributeName` | `PointerAttributeName` | The attribute on this Table which points to items of the peer Table. |
| `params.type` | `RT` | The nature of the table relationship. |

#### Returns

`void`

#### Defined in

[src/classes/Table.ts:107](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L107)
