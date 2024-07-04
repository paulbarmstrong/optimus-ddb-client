[optimus-ddb-client](../index.md) / TableRelationshipViolationError

# Class: TableRelationshipViolationError

Error for when OptimusDdbClient `commitItems`' items violate a Table relationship.

## Hierarchy

- `Error`

  ↳ **`TableRelationshipViolationError`**

## Table of contents

### Constructors

- [constructor](TableRelationshipViolationError.md#constructor)

### Properties

- [cause](TableRelationshipViolationError.md#cause)
- [message](TableRelationshipViolationError.md#message)
- [name](TableRelationshipViolationError.md#name)
- [stack](TableRelationshipViolationError.md#stack)
- [prepareStackTrace](TableRelationshipViolationError.md#preparestacktrace)
- [stackTraceLimit](TableRelationshipViolationError.md#stacktracelimit)

### Methods

- [captureStackTrace](TableRelationshipViolationError.md#capturestacktrace)

## Constructors

### constructor

• **new TableRelationshipViolationError**(`params`): [`TableRelationshipViolationError`](TableRelationshipViolationError.md)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.item` | `Record`\<`string`, `any`\> | Item triggering the Table relationship violation. |
| `params.tableRelationshipType` | [`TableRelationshipType`](../enums/TableRelationshipType.md) | The type of the TableRelationship. |
| `params.tables` | [[`Table`](Table.md)\<`any`, `any`, `any`\>, [`Table`](Table.md)\<`any`, `any`, `any`\>] | The tables of the TableRelationship. |

#### Returns

[`TableRelationshipViolationError`](TableRelationshipViolationError.md)

#### Overrides

Error.constructor

#### Defined in

[src/Types.ts:150](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L150)

## Properties

### cause

• `Optional` **cause**: `unknown`

#### Inherited from

Error.cause

#### Defined in

node_modules/typescript/lib/lib.es2022.error.d.ts:24

___

### message

• **message**: `string`

#### Inherited from

Error.message

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1076

___

### name

• **name**: `string` = `"TableRelationshipViolationError"`

#### Overrides

Error.name

#### Defined in

[src/Types.ts:149](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L149)

___

### stack

• `Optional` **stack**: `string`

#### Inherited from

Error.stack

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1077

___

### prepareStackTrace

▪ `Static` `Optional` **prepareStackTrace**: (`err`: `Error`, `stackTraces`: `CallSite`[]) => `any`

#### Type declaration

▸ (`err`, `stackTraces`): `any`

Optional override for formatting stack traces

##### Parameters

| Name | Type |
| :------ | :------ |
| `err` | `Error` |
| `stackTraces` | `CallSite`[] |

##### Returns

`any`

**`See`**

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

#### Inherited from

Error.prepareStackTrace

#### Defined in

node_modules/@types/node/globals.d.ts:28

___

### stackTraceLimit

▪ `Static` **stackTraceLimit**: `number`

#### Inherited from

Error.stackTraceLimit

#### Defined in

node_modules/@types/node/globals.d.ts:30

## Methods

### captureStackTrace

▸ **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Create .stack property on a target object

#### Parameters

| Name | Type |
| :------ | :------ |
| `targetObject` | `object` |
| `constructorOpt?` | `Function` |

#### Returns

`void`

#### Inherited from

Error.captureStackTrace

#### Defined in

node_modules/@types/node/globals.d.ts:21
