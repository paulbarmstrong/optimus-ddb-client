[optimus-ddb-client](../index.md) / UnprocessedKeysError

# Class: UnprocessedKeysError

Error for when OptimusDdbClient's `getItems` ends with unprocessedKeys. Please see [the DynamoDB
documentation](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html)
for why that may happen.

## Hierarchy

- `Error`

  ↳ **`UnprocessedKeysError`**

## Table of contents

### Constructors

- [constructor](UnprocessedKeysError.md#constructor)

### Properties

- [cause](UnprocessedKeysError.md#cause)
- [message](UnprocessedKeysError.md#message)
- [name](UnprocessedKeysError.md#name)
- [stack](UnprocessedKeysError.md#stack)
- [unprocessedKeys](UnprocessedKeysError.md#unprocessedkeys)
- [prepareStackTrace](UnprocessedKeysError.md#preparestacktrace)
- [stackTraceLimit](UnprocessedKeysError.md#stacktracelimit)

### Methods

- [captureStackTrace](UnprocessedKeysError.md#capturestacktrace)

## Constructors

### constructor

• **new UnprocessedKeysError**(`params`): [`UnprocessedKeysError`](UnprocessedKeysError.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `params` | `Object` |
| `params.unprocessedKeys` | `Record`\<`string`, `any`\>[] |

#### Returns

[`UnprocessedKeysError`](UnprocessedKeysError.md)

#### Overrides

Error.constructor

#### Defined in

[src/Types.ts:51](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L51)

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

• **name**: `string` = `"ItemNotFoundError"`

#### Overrides

Error.name

#### Defined in

[src/Types.ts:49](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L49)

___

### stack

• `Optional` **stack**: `string`

#### Inherited from

Error.stack

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1077

___

### unprocessedKeys

• `Readonly` **unprocessedKeys**: `Record`\<`string`, `any`\>[]

#### Defined in

[src/Types.ts:50](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L50)

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
