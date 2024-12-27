[optimus-ddb-client](../index.md) / ItemValidationError

# Class: ItemValidationError

Error for when OptimusDdbClient encounters an item that does not match its Table's `itemSchema`.

## Hierarchy

- `Error`

  ↳ **`ItemValidationError`**

## Table of contents

### Constructors

- [constructor](ItemValidationError.md#constructor)

### Properties

- [cause](ItemValidationError.md#cause)
- [issues](ItemValidationError.md#issues)
- [message](ItemValidationError.md#message)
- [name](ItemValidationError.md#name)
- [stack](ItemValidationError.md#stack)
- [prepareStackTrace](ItemValidationError.md#preparestacktrace)
- [stackTraceLimit](ItemValidationError.md#stacktracelimit)

### Methods

- [captureStackTrace](ItemValidationError.md#capturestacktrace)

## Constructors

### constructor

• **new ItemValidationError**(`zodError`): [`ItemValidationError`](ItemValidationError.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `zodError` | `ZodError`\<`any`\> |

#### Returns

[`ItemValidationError`](ItemValidationError.md)

#### Overrides

Error.constructor

#### Defined in

[src/Types.ts:165](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L165)

## Properties

### cause

• `Optional` **cause**: `unknown`

#### Inherited from

Error.cause

#### Defined in

node_modules/typescript/lib/lib.es2022.error.d.ts:24

___

### issues

• **issues**: `ZodIssue`[]

#### Defined in

[src/Types.ts:164](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L164)

___

### message

• **message**: `string`

#### Inherited from

Error.message

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1076

___

### name

• **name**: `string` = `"ItemValidationError"`

#### Overrides

Error.name

#### Defined in

[src/Types.ts:163](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L163)

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
