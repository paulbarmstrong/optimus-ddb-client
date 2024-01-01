[optimus-ddb-client](../index.md) / ItemNotFoundError

# Class: ItemNotFoundError

Error for when item(s) are not found. It means that item(s) did not exist in the index when
OptimusDdbClient's `getItem` or `getItems` was called.

## Hierarchy

- `Error`

  ↳ **`ItemNotFoundError`**

## Table of contents

### Constructors

- [constructor](ItemNotFoundError.md#constructor)

### Properties

- [cause](ItemNotFoundError.md#cause)
- [itemKeys](ItemNotFoundError.md#itemkeys)
- [message](ItemNotFoundError.md#message)
- [name](ItemNotFoundError.md#name)
- [stack](ItemNotFoundError.md#stack)
- [prepareStackTrace](ItemNotFoundError.md#preparestacktrace)
- [stackTraceLimit](ItemNotFoundError.md#stacktracelimit)

### Methods

- [captureStackTrace](ItemNotFoundError.md#capturestacktrace)

## Constructors

### constructor

• **new ItemNotFoundError**(`params`): [`ItemNotFoundError`](ItemNotFoundError.md)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.itemKeys` | `Record`\<`string`, `any`\>[] | The keys of the item(s) that were not found. |

#### Returns

[`ItemNotFoundError`](ItemNotFoundError.md)

#### Overrides

Error.constructor

#### Defined in

[src/Types.ts:65](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L65)

## Properties

### cause

• `Optional` **cause**: `unknown`

#### Inherited from

Error.cause

#### Defined in

node_modules/typescript/lib/lib.es2022.error.d.ts:24

___

### itemKeys

• `Readonly` **itemKeys**: `Record`\<`string`, `any`\>[]

The keys of the item(s) that were not found.

#### Defined in

[src/Types.ts:64](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L64)

___

### message

• **message**: `string`

#### Inherited from

Error.message

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1076

___

### name

• **name**: `string` = `"ItemNotFoundError"`

#### Overrides

Error.name

#### Defined in

[src/Types.ts:62](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L62)

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
