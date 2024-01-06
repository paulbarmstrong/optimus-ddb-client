optimus-ddb-client

# optimus-ddb-client

This is low level documentation. Please see [README.md](../README.md) for the high level documentation.

## Table of contents

### Classes

- [Gsi](classes/Gsi.md)
- [InvalidResumeKeyError](classes/InvalidResumeKeyError.md)
- [ItemNotFoundError](classes/ItemNotFoundError.md)
- [ItemShapeValidationError](classes/ItemShapeValidationError.md)
- [OptimisticLockError](classes/OptimisticLockError.md)
- [OptimusDdbClient](classes/OptimusDdbClient.md)
- [Table](classes/Table.md)
- [UnprocessedKeysError](classes/UnprocessedKeysError.md)

### Type Aliases

- [FilterCondition](index.md#filtercondition)
- [PartitionKeyCondition](index.md#partitionkeycondition)
- [SortKeyCondition](index.md#sortkeycondition)

## Type Aliases

### FilterCondition

Ƭ **FilterCondition**\<`L`, `R`\>: [`L`, ``"exists"`` \| ``"doesn't exist"``] \| `R` extends `string` ? [`L`, ``"="``, `R`] \| [`L`, ``"<>"`` \| ``"!="`` \| ``"<"`` \| ``">"`` \| ``"<="`` \| ``">="`` \| ``"begins with"`` \| ``"contains"``, `string`] \| [`L`, ``"between"``, `string`, ``"and"``, `string`] \| [`L`, ``"in"``, `R`[]] : `R` extends `number` \| `Uint8Array` ? [`L`, ``"="`` \| ``"<>"`` \| ``"!="`` \| ``"<"`` \| ``">"`` \| ``"<="`` \| ``">="``, `R`] \| [`L`, ``"between"``, `R`, ``"and"``, `R`] \| [`L`, ``"in"``, `R`[]] : `R` extends `any`[] ? [`L`, ``"contains"``, `any`] : [`L`, ``"="``, `R`]

Type representing a condition for filtering query or scan results.

#### Type parameters

| Name |
| :------ |
| `L` |
| `R` |

#### Defined in

[src/Types.ts:26](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L26)

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

[src/Types.ts:12](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L12)

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

[src/Types.ts:15](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L15)
