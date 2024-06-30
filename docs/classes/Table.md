[optimus-ddb-client](../index.md) / Table

# Class: Table\<I, P, S\>

Table represents a DynamoDB Table. It can be created once and then provided to OptimusDdbClient
when doing operations on items.

#### Regarding `itemShape`

The `itemShape` constructor parameter is a Shape representing the structure of items in the table. The Shape
should be an ObjectShape (or UnionShape of ObjectShapes) including all attributes except for the version
attribute which is abstracted from OptimusDdbClient consumers.

The mappings between DynamoDB types and Shapes are as follows:

|DynamoDB Type|Shape class|Shape creation example|
|-------------|-----------|-------|
|S            |StringShape|`s.string()`|
|N            |NumberShape|`s.number()`|
|BOOL         |BooleanShape|`s.number()`|
|B            |ClassShape\<Uint8Array\>|`s.class(Uint8Array)`|
|M            |ObjectShape|`s.object({})`|
|L            |ArrayShape|`s.array(s.string())`|
|NULL         |LiteralShape\<null\>|`s.literal(null)`|
|(Absent Attribute)|LiteralShape\<undefined\>|`s.literal(undefined)`|

An item Shape for a table with items having S attributes "id" and "text" (and N attribute "version" for optimistic 
locking) might be:

```
s.object({ id: s.string(), text: s.string() })
```

Please see the shape-tape documentation for more details about creating shapes.

## Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `ObjectShape`\<`any`, `any`\> \| `UnionShape`\<`ObjectShape`\<`any`, `any`\>[]\> |
| `P` | extends keyof `ShapeToType`\<`I`\> |
| `S` | extends keyof `ShapeToType`\<`I`\> = `never` |

## Table of contents

### Constructors

- [constructor](Table.md#constructor)

### Properties

- [attributes](Table.md#attributes)
- [itemShape](Table.md#itemshape)
- [keyAttributes](Table.md#keyattributes)
- [partitionKey](Table.md#partitionkey)
- [sortKey](Table.md#sortkey)
- [tableName](Table.md#tablename)
- [versionAttribute](Table.md#versionattribute)

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
| `I` | extends `ObjectShape`\<`any`, `any`\> \| `UnionShape`\<`ObjectShape`\<`any`, `any`\>[]\> |
| `P` | extends `string` \| `number` \| `symbol` |
| `S` | extends `string` \| `number` \| `symbol` = `never` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.itemShape` | `I` | Shape representing the structure of items in the table. Please see the top-level Table class documentation for details. |
| `params.partitionKey` | `P` | The name of the DynamoDB table's partition key. |
| `params.sortKey?` | `S` | The name of the DynamoDB table's sort key. It must be provided if and only if the table has a sort key. |
| `params.tableName` | `string` | The TableName of the DynamoDB table. |
| `params.versionAttribute?` | `string` | The name of the N attribute to be used for optimistic locking. The default is "version". |

#### Returns

[`Table`](Table.md)\<`I`, `P`, `S`\>

#### Defined in

[src/classes/Table.ts:65](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L65)

## Properties

### attributes

• `Readonly` **attributes**: `string`[]

The names of all of the item attributes (except for the version attribute).

#### Defined in

[src/classes/Table.ts:57](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L57)

___

### itemShape

• `Readonly` **itemShape**: `I`

Shape representing the structure of items in the table. Please see the Table class documentation for details.

#### Defined in

[src/classes/Table.ts:51](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L51)

___

### keyAttributes

• `Readonly` **keyAttributes**: `string`[]

The names of all of the key attributes. It will contain either 1 or 2 items depending on
if the table has a sort key.

#### Defined in

[src/classes/Table.ts:62](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L62)

___

### partitionKey

• `Readonly` **partitionKey**: `P`

The name of the DynamoDB table's partition key.

#### Defined in

[src/classes/Table.ts:53](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L53)

___

### sortKey

• `Optional` `Readonly` **sortKey**: `S`

The name of the DynamoDB table's sort key or `undefined` if it has no sort key.

#### Defined in

[src/classes/Table.ts:55](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L55)

___

### tableName

• `Readonly` **tableName**: `string`

The name of the DynamoDB table.

#### Defined in

[src/classes/Table.ts:49](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L49)

___

### versionAttribute

• `Readonly` **versionAttribute**: `string`

The name of the version attribute used for optimistic locking.

#### Defined in

[src/classes/Table.ts:64](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L64)

## Accessors

### relationships

• `get` **relationships**(): \{ `compositeKeySeparator`: `string` ; `peerPointerAttributeName`: `string` ; `peerTable`: [`Table`](Table.md)\<`any`, `any`, `any`\> ; `pointerAttributeName`: `string` ; `type`: [`ONE_TO_ONE`](../enums/TableRelationshipType.md#one_to_one)  }[]

The relationships that are applied to the Table. For each relationship, the peer Table has a
corresponding inverted relationship to this Table.

#### Returns

\{ `compositeKeySeparator`: `string` ; `peerPointerAttributeName`: `string` ; `peerTable`: [`Table`](Table.md)\<`any`, `any`, `any`\> ; `pointerAttributeName`: `string` ; `type`: [`ONE_TO_ONE`](../enums/TableRelationshipType.md#one_to_one)  }[]

#### Defined in

[src/classes/Table.ts:154](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L154)

## Methods

### addRelationship

▸ **addRelationship**\<`RT`, `PointerAttributeName`, `I1`, `P1`, `S1`, `PeerPointerAttributeName`\>(`params`): `void`

Add a relationship to the Table. Table relationships are enforced upon OptimusDdbClient's `commitItems`.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `RT` | extends [`ONE_TO_ONE`](../enums/TableRelationshipType.md#one_to_one) |
| `PointerAttributeName` | extends `string` \| `number` \| `symbol` |
| `I1` | extends `ObjectShape`\<`any`, `any`\> \| `UnionShape`\<`ObjectShape`\<`any`, `any`\>[]\> |
| `P1` | extends `string` \| `number` \| `symbol` |
| `S1` | extends `string` \| `number` \| `symbol` |
| `PeerPointerAttributeName` | extends `string` \| `number` \| `symbol` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.compositeKeySeparator?` | `string` | The separator used to join the partition key and sort key when one of the Tables has a sort key. |
| `params.peerPointerAttributeName` | `PeerPointerAttributeName` | The attribute on the peer Table which points to items of this Table. |
| `params.peerTable` | [`Table`](Table.md)\<`I1`, `P1`, `S1`\> | The other Table in the relationship. |
| `params.pointerAttributeName` | `PointerAttributeName` | The attribute on this Table which points to items of the peer Table. |
| `params.type` | `RT` | The nature of the table relationship. |

#### Returns

`void`

#### Defined in

[src/classes/Table.ts:110](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Table.ts#L110)
