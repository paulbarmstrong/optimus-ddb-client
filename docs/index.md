optimus-ddb-client

# optimus-ddb-client

This is low level documentation. Please see [README.md](../README.md) for the high level documentation.

## Table of contents

### Enumerations

- [TableRelationshipType](enums/TableRelationshipType.md)

### Classes

- [Gsi](classes/Gsi.md)
- [InvalidResumeKeyError](classes/InvalidResumeKeyError.md)
- [ItemNotFoundError](classes/ItemNotFoundError.md)
- [ItemValidationError](classes/ItemValidationError.md)
- [OptimisticLockError](classes/OptimisticLockError.md)
- [OptimusDdbClient](classes/OptimusDdbClient.md)
- [Table](classes/Table.md)
- [TableRelationshipViolationError](classes/TableRelationshipViolationError.md)
- [UnprocessedKeysError](classes/UnprocessedKeysError.md)

### Type Aliases

- [FilterCondition](index.md#filtercondition)
- [PartitionKeyCondition](index.md#partitionkeycondition)
- [SortKeyCondition](index.md#sortkeycondition)

## Type Aliases

### FilterCondition

Ƭ **FilterCondition**\<`I`\>: \{ [K in keyof I]: FilterConditionLeaf\<K, I[K]\> }[keyof `I`] \| [[`FilterCondition`](index.md#filtercondition)\<`I`\>, ``"or"``, [`FilterCondition`](index.md#filtercondition)\<`I`\>] \| [[`FilterCondition`](index.md#filtercondition)\<`I`\>, ``"and"``, [`FilterCondition`](index.md#filtercondition)\<`I`\>] \| [[`FilterCondition`](index.md#filtercondition)\<`I`\>]

Type representing a condition for filtering items during a query or scan.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `Record`\<`string`, `any`\> |

#### Defined in

[src/Types.ts:42](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L42)

___

### PartitionKeyCondition

Ƭ **PartitionKeyCondition**\<`L`, `R`\>: [`L`, ``"="``, `R`]

Type representing a condition that specifies a partition.

#### Type parameters

| Name |
| :------ |
| `L` |
| `R` |

#### Defined in

[src/Types.ts:13](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L13)

___

### SortKeyCondition

Ƭ **SortKeyCondition**\<`L`, `R`\>: `R` extends `string` ? [`L`, ``"="``, `R`] \| [`L`, ``"<"`` \| ``">"`` \| ``"<="`` \| ``">="`` \| ``"begins with"``, `string`] \| [`L`, ``"between"``, `string`, ``"and"``, `string`] : `R` extends `Uint8Array` ? [`L`, ``"="``, `R`] \| [`L`, ``"<"`` \| ``">"`` \| ``"<="`` \| ``">="`` \| ``"begins with"``, `Uint8Array`] \| [`L`, ``"between"``, `Uint8Array`, ``"and"``, `Uint8Array`] : [`L`, ``"="`` \| ``"<"`` \| ``">"`` \| ``"<="`` \| ``">="``, `R`] \| [`L`, ``"between"``, `R`, ``"and"``, `R`]

Type representing a condition that specifies how a partition is queried.

#### Type parameters

| Name |
| :------ |
| `L` |
| `R` |

#### Defined in

[src/Types.ts:16](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L16)
