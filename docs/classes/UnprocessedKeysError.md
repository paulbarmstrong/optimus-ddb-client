[optimus-ddb-client](../index.md) / UnprocessedKeysError

# Class: UnprocessedKeysError

Error for when OptimusDdbClient is unable to get DynamoDB to process one or more
keys while it is calling BatchGetItem. ends with unprocessedKeys. DynamoDB doesn't
specify the reason for the items being unprocessed. Please see [the DynamoDB BatchGetItem documentation
](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html) for why
that may happen.

OptimusDdbClient's retry strategy for BatchGetItem is to keep calling with up to 100 keys
at a time until either it gets everything it needs or there's a call where every key
it asks for comes back in UnproccessedKeys.

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

[src/Types.ts:59](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L59)

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

[src/Types.ts:57](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L57)

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

[src/Types.ts:58](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L58)

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
