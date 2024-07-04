[optimus-ddb-client](../index.md) / OptimisticLockError

# Class: OptimisticLockError

Error for when OptimusDdbClient `commitItem`'s transaction is cancelled due to a conditional check failure.

## Hierarchy

- `Error`

  ↳ **`OptimisticLockError`**

## Table of contents

### Constructors

- [constructor](OptimisticLockError.md#constructor)

### Properties

- [cause](OptimisticLockError.md#cause)
- [message](OptimisticLockError.md#message)
- [name](OptimisticLockError.md#name)
- [stack](OptimisticLockError.md#stack)
- [prepareStackTrace](OptimisticLockError.md#preparestacktrace)
- [stackTraceLimit](OptimisticLockError.md#stacktracelimit)

### Methods

- [captureStackTrace](OptimisticLockError.md#capturestacktrace)

## Constructors

### constructor

• **new OptimisticLockError**(): [`OptimisticLockError`](OptimisticLockError.md)

#### Returns

[`OptimisticLockError`](OptimisticLockError.md)

#### Overrides

Error.constructor

#### Defined in

[src/Types.ts:120](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L120)

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

• **name**: `string` = `"OptimisticLockError"`

#### Overrides

Error.name

#### Defined in

[src/Types.ts:119](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L119)

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
