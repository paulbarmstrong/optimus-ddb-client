[optimus-ddb-client](../index.md) / InvalidResumeKeyError

# Class: InvalidResumeKeyError

Error for when OptimusDdbClient is given an invalid resumeKey.

## Hierarchy

- `Error`

  ↳ **`InvalidResumeKeyError`**

## Table of contents

### Constructors

- [constructor](InvalidResumeKeyError.md#constructor)

### Properties

- [cause](InvalidResumeKeyError.md#cause)
- [message](InvalidResumeKeyError.md#message)
- [name](InvalidResumeKeyError.md#name)
- [stack](InvalidResumeKeyError.md#stack)
- [prepareStackTrace](InvalidResumeKeyError.md#preparestacktrace)
- [stackTraceLimit](InvalidResumeKeyError.md#stacktracelimit)

### Methods

- [captureStackTrace](InvalidResumeKeyError.md#capturestacktrace)

## Constructors

### constructor

• **new InvalidResumeKeyError**(): [`InvalidResumeKeyError`](InvalidResumeKeyError.md)

#### Returns

[`InvalidResumeKeyError`](InvalidResumeKeyError.md)

#### Overrides

Error.constructor

#### Defined in

[src/Types.ts:97](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L97)

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

• **name**: `string` = `"InvalidResumeKeyError"`

#### Overrides

Error.name

#### Defined in

[src/Types.ts:96](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L96)

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
