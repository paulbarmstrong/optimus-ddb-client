[optimus-ddb-client](../index.md) / Gsi

# Class: Gsi\<I, P, S\>

Gsi represents a DynamoDB Global Secondary Index (GSI). It can be created once and then
provided to OptimusDdbClient when doing query and scan operations.

## Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `ObjectShape`\<`any`, `any`\> \| `UnionShape`\<`ObjectShape`\<`any`, `any`\>[]\> |
| `P` | extends keyof `MergeUnion`\<`ShapeToType`\<`I`\>\> |
| `S` | extends keyof `MergeUnion`\<`ShapeToType`\<`I`\>\> = `never` |

## Table of contents

### Constructors

- [constructor](Gsi.md#constructor)

### Properties

- [indexName](Gsi.md#indexname)
- [partitionKey](Gsi.md#partitionkey)
- [sortKey](Gsi.md#sortkey)
- [table](Gsi.md#table)

## Constructors

### constructor

• **new Gsi**\<`I`, `P`, `S`\>(`params`): [`Gsi`](Gsi.md)\<`I`, `P`, `S`\>

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
| `params.indexName` | `string` | The IndexName of the GSI. |
| `params.partitionKey` | `P` | The name of the GSI's partition key. |
| `params.sortKey?` | `S` | The name of the GSI's sort key. It must be provided if and only if the GSI has a sort key. |
| `params.table` | [`Table`](Table.md)\<`I`, `any`, `any`\> | The Table class instance representing the DynamoDB table of the GSI. |

#### Returns

[`Gsi`](Gsi.md)\<`I`, `P`, `S`\>

#### Defined in

[src/classes/Gsi.ts:18](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Gsi.ts#L18)

## Properties

### indexName

• **indexName**: `string`

The IndexName of the GSI.

#### Defined in

[src/classes/Gsi.ts:13](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Gsi.ts#L13)

___

### partitionKey

• **partitionKey**: `P`

The name of the GSI's partition key.

#### Defined in

[src/classes/Gsi.ts:15](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Gsi.ts#L15)

___

### sortKey

• `Optional` **sortKey**: `S`

The name of the GSI's sort key or `undefined` if it has no sort key.

#### Defined in

[src/classes/Gsi.ts:17](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Gsi.ts#L17)

___

### table

• **table**: [`Table`](Table.md)\<`I`, `any`, `any`\>

The Table class instance representing the DynamoDB table of the GSI.

#### Defined in

[src/classes/Gsi.ts:11](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/Gsi.ts#L11)
