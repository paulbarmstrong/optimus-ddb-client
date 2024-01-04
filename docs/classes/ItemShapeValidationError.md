[optimus-ddb-client](../index.md) / ItemShapeValidationError

# Class: ItemShapeValidationError

Error for when OptimusDdbClient encounters an item that does not match its Table's `itemShape`.

## Hierarchy

- `ShapeValidationError`

  ↳ **`ItemShapeValidationError`**

## Table of contents

### Constructors

- [constructor](ItemShapeValidationError.md#constructor)

### Properties

- [cause](ItemShapeValidationError.md#cause)
- [data](ItemShapeValidationError.md#data)
- [message](ItemShapeValidationError.md#message)
- [name](ItemShapeValidationError.md#name)
- [path](ItemShapeValidationError.md#path)
- [shape](ItemShapeValidationError.md#shape)
- [stack](ItemShapeValidationError.md#stack)
- [prepareStackTrace](ItemShapeValidationError.md#preparestacktrace)
- [stackTraceLimit](ItemShapeValidationError.md#stacktracelimit)

### Methods

- [captureStackTrace](ItemShapeValidationError.md#capturestacktrace)

## Constructors

### constructor

• **new ItemShapeValidationError**(`params`): [`ItemShapeValidationError`](ItemShapeValidationError.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `params` | `Object` |
| `params.data` | `any` |
| `params.path` | (`string` \| `number`)[] |
| `params.shape` | `Shape` |

#### Returns

[`ItemShapeValidationError`](ItemShapeValidationError.md)

#### Overrides

ShapeValidationError.constructor

#### Defined in

[src/Types.ts:100](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L100)

## Properties

### cause

• `Optional` **cause**: `unknown`

#### Inherited from

ShapeValidationError.cause

#### Defined in

node_modules/typescript/lib/lib.es2022.error.d.ts:24

___

### data

• `Readonly` **data**: `any`

The most specific data which was found to not match the corresponding Shape.

#### Inherited from

ShapeValidationError.data

#### Defined in

node_modules/shape-tape/dist/src/ValidationError.d.ts:10

___

### message

• **message**: `string`

#### Inherited from

ShapeValidationError.message

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1076

___

### name

• **name**: `string` = `"ItemShapeValidationError"`

#### Overrides

ShapeValidationError.name

#### Defined in

[src/Types.ts:99](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L99)

___

### path

• `Readonly` **path**: (`string` \| `number`)[]

The path to where in the data the error occurred.

#### Inherited from

ShapeValidationError.path

#### Defined in

node_modules/shape-tape/dist/src/ValidationError.d.ts:8

___

### shape

• `Readonly` **shape**: `Shape`

The specific Shape which the data did not match.

#### Inherited from

ShapeValidationError.shape

#### Defined in

node_modules/shape-tape/dist/src/ValidationError.d.ts:12

___

### stack

• `Optional` **stack**: `string`

#### Inherited from

ShapeValidationError.stack

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

ShapeValidationError.prepareStackTrace

#### Defined in

node_modules/@types/node/globals.d.ts:28

___

### stackTraceLimit

▪ `Static` **stackTraceLimit**: `number`

#### Inherited from

ShapeValidationError.stackTraceLimit

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

ShapeValidationError.captureStackTrace

#### Defined in

node_modules/@types/node/globals.d.ts:21
