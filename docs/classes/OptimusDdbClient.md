[optimus-ddb-client](../index.md) / OptimusDdbClient

# Class: OptimusDdbClient

Class to be used as a high level DynamoDB client. Consumers call various functions on their 
OptimusDdbClient to perform operations on items in their tables. Please see the README for more
high level information.

The overhead associated with an instance of OptimusDdbClient is similar to that of
DynamoDBDocumentClient from the AWS SDK (that's because OptimusDdbClient creates a 
DynamoDBDocumentClient).

Most failure modes correspond to DynamoDBDocumentClient errors and in those cases OptimusDdbClient
lets the error propagate out to the caller. OptimusDdbClient also has some of its own errors types
and those are mentioned on each function documentation.

## Table of contents

### Constructors

- [constructor](OptimusDdbClient.md#constructor)

### Methods

- [commitItems](OptimusDdbClient.md#commititems)
- [draftItem](OptimusDdbClient.md#draftitem)
- [getItem](OptimusDdbClient.md#getitem)
- [getItemVersion](OptimusDdbClient.md#getitemversion)
- [getItems](OptimusDdbClient.md#getitems)
- [markItemForDeletion](OptimusDdbClient.md#markitemfordeletion)
- [queryItems](OptimusDdbClient.md#queryitems)
- [scanItems](OptimusDdbClient.md#scanitems)

## Constructors

### constructor

• **new OptimusDdbClient**(`params?`): [`OptimusDdbClient`](OptimusDdbClient.md)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params?` | `Object` | - |
| `params.dynamoDbClientConfig?` | `DynamoDBClientConfig` | Any DynamoDBClientConfig options for OptimusDdbClient to consider. |

#### Returns

[`OptimusDdbClient`](OptimusDdbClient.md)

#### Defined in

[src/classes/OptimusDdbClient.ts:42](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/OptimusDdbClient.ts#L42)

## Methods

### commitItems

▸ **commitItems**(`params`): `Promise`\<`void`\>

Commits items together in a transaction. It calls [the TransactWriteItems DynamoDB API](
https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html).

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.items` | `Record`\<`string`, `any`\>[] | Items to be committed together. They need to be items produced by OptimusDdbClient. The limit is 100 (except that items having a key change count as 2). |
| `params.optimisticLockErrorOverride?` | (`e`: [`OptimisticLockError`](OptimisticLockError.md)) => `Error` | Optional parameter to override `OptimisticLockError`. |

#### Returns

`Promise`\<`void`\>

**`Throws`**

ItemValidationError if an item does not match the Table's `itemSchema`.

**`Throws`**

OptimisticLockError if the transaction is cancelled due to a conditional check failure.

#### Defined in

[src/classes/OptimusDdbClient.ts:305](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/OptimusDdbClient.ts#L305)

___

### draftItem

▸ **draftItem**\<`I`, `P`, `S`, `T`\>(`params`): `T`

Drafts an item for creation. It does not call DynamoDB. The item is only
created in DynamoDB once it is included in the `items` of a call to `commitItems`.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `NonStripZodObject` \| `ZodUnion`\<[`NonStripZodObject`, ...NonStripZodObject[]]\> |
| `P` | extends `string` \| `number` \| `symbol` |
| `S` | extends `string` \| `number` \| `symbol` |
| `T` | extends `Object` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.item` | `T` | Object representing the item to be drafted. It should be an object not provided to OptimusDdbClient before. |
| `params.table` | [`Table`](Table.md)\<`I`, `P`, `S`\> | Table where the item should go. |

#### Returns

`T`

The drafted item.

**`Throws`**

ItemValidationError if the item does not match the Table's `itemSchema`.

#### Defined in

[src/classes/OptimusDdbClient.ts:61](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/OptimusDdbClient.ts#L61)

___

### getItem

▸ **getItem**\<`I`, `P`, `S`, `E`\>(`params`): `Promise`\<`E` extends `Error` ? `TypeOf`\<`I`\> : `undefined` \| `TypeOf`\<`I`\>\>

Gets an item from the given Table with the given key. It calls [the GetItem DynamoDB API](
https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html).

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `NonStripZodObject` \| `ZodUnion`\<[`NonStripZodObject`, ...NonStripZodObject[]]\> |
| `P` | extends `string` \| `number` \| `symbol` |
| `S` | extends `string` \| `number` \| `symbol` |
| `E` | extends `undefined` \| `Error` = `Error` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.itemNotFoundErrorOverride?` | (`e`: [`ItemNotFoundError`](ItemNotFoundError.md)) => `E` | Optional parameter to override `ItemNotFoundError`. If it returns `Error` then `getItem` will throw that error instead of `ItemNotFoundError`. If it returns `undefined` then `getItem` will return `undefined` instead of throwing `ItemNotFoundError`. |
| `params.key` | \{ [T in string \| number \| symbol]: TypeOf\<I\>[P] } & \{ [T in string \| number \| symbol]: TypeOf\<I\>[S] } | Key to look up. |
| `params.table` | [`Table`](Table.md)\<`I`, `P`, `S`\> | Table to look in. |

#### Returns

`Promise`\<`E` extends `Error` ? `TypeOf`\<`I`\> : `undefined` \| `TypeOf`\<`I`\>\>

The item with the given key (or `undefined` if the item is not found and 
`itemNotFoundErrorOverride` is set to a function that returns `undefined`).

**`Throws`**

ItemNotFoundError if the item is not found (and `itemNotFoundErrorOverride` is not set).

**`Throws`**

ItemValidationError if the item does not match the Table's `itemSchema`.

#### Defined in

[src/classes/OptimusDdbClient.ts:93](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/OptimusDdbClient.ts#L93)

___

### getItemVersion

▸ **getItemVersion**(`params`): `number`

Gets an item's optimistic locking version number.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.item` | `Record`\<`string`, `any`\> | An item produced by OptimusDdbClient |

#### Returns

`number`

The item's optimistic locking version number.

#### Defined in

[src/classes/OptimusDdbClient.ts:400](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/OptimusDdbClient.ts#L400)

___

### getItems

▸ **getItems**\<`I`, `P`, `S`\>(`params`): `Promise`\<`TypeOf`\<`I`\>[]\>

Gets items from the given Table with the given keys. It calls [the BatchGetItem DynamoDB API](
https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html) as many times as
necessary to get all the requested items.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `NonStripZodObject` \| `ZodUnion`\<[`NonStripZodObject`, ...NonStripZodObject[]]\> |
| `P` | extends `string` \| `number` \| `symbol` |
| `S` | extends `string` \| `number` \| `symbol` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.itemNotFoundErrorOverride?` | (`e`: [`ItemNotFoundError`](ItemNotFoundError.md)) => `undefined` \| `Error` | Optional parameter to override `ItemNotFoundError`. If it returns `Error` then `getItems` will throw that error instead of `ItemNotFoundError`. If it returns `undefined` then `getItems` will omit the item from its response instead of throwing `ItemNotFoundError`. |
| `params.keys` | \{ [T in string \| number \| symbol]: TypeOf\<I\>[P] } & \{ [T in string \| number \| symbol]: TypeOf\<I\>[S] }[] | Keys to look up. |
| `params.table` | [`Table`](Table.md)\<`I`, `P`, `S`\> | Table to look in. |

#### Returns

`Promise`\<`TypeOf`\<`I`\>[]\>

All of the items with the given keys (or just the items that were found if 
`itemNotFoundErrorOverride` is set to a function that returns `undefined`).

**`Throws`**

UnprocessedKeysError when OptimusDdbClient is unable to get DynamoDB to process one or more
keys while it is calling BatchGetItem.

**`Throws`**

ItemNotFoundError if one or more items are not found (and `itemNotFoundErrorOverride` is not set).

**`Throws`**

ItemValidationError if an item does not match the Table's `itemSchema`.

#### Defined in

[src/classes/OptimusDdbClient.ts:139](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/OptimusDdbClient.ts#L139)

___

### markItemForDeletion

▸ **markItemForDeletion**(`params`): `void`

Marks an item for deletion. It does not call DynamoDB. The item is only
deleted in DynamoDB once it is included in the `items` of a call to `commitItems`

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.item` | `Record`\<`string`, `any`\> | Item to be marked for deletion. It needs to be an item produced by OptimusDdbClient. |

#### Returns

`void`

#### Defined in

[src/classes/OptimusDdbClient.ts:75](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/OptimusDdbClient.ts#L75)

___

### queryItems

▸ **queryItems**\<`I`, `P`, `S`, `L`\>(`params`): `Promise`\<[`TypeOf`\<`I`\>[], `L` extends `number` ? `undefined` \| `string` : `undefined`]\>

Querys items on the given Table or Gsi with the given conditions. It calls [the Query DynamoDB API](
https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html) as many times as necessary to hit the 
specified limit or hit the end of the index. It may also call [the BatchGetItem DynamoDB API](
https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html) when it queries items from GSIs 
that don't project the attributes defined by the Table's itemSchema.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `NonStripZodObject` \| `ZodUnion`\<[`NonStripZodObject`, ...NonStripZodObject[]]\> |
| `P` | extends `string` \| `number` \| `symbol` |
| `S` | extends `string` \| `number` \| `symbol` |
| `L` | extends `undefined` \| `number` = `undefined` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.filterCondition?` | [`FilterCondition`](../index.md#filtercondition)\<`Omit`\<`Omit`\<`MergeUnion`\<`TypeOf`\<`I`\>\>, `P`\>, `S`\>\> | Optional condition to filter items during the query. |
| `params.index` | [`Table`](Table.md)\<`I`, `P`, `S`\> \| [`Gsi`](Gsi.md)\<`I`, `P`, `S`\> | The table or GSI to query. |
| `params.invalidResumeKeyErrorOverride?` | (`e`: [`InvalidResumeKeyError`](InvalidResumeKeyError.md)) => `Error` | Optional parameter to override `InvalidResumeKeyError`. |
| `params.limit?` | `L` | Optional limit on the number of items to find before returning. |
| `params.partitionKeyCondition` | [`PartitionKeyCondition`](../index.md#partitionkeycondition)\<`P`, `TypeOf`\<`I`\>[`P`]\> | Condition to specify which partition the Query will take place in. |
| `params.resumeKey?` | `string` | Optional parameter to continue based on a `resumeKey` returned from an earlier `queryItems` call. |
| `params.scanIndexForward?` | `boolean` | Optional parameter used to switch the order of the query. |
| `params.sortKeyCondition?` | `AnyToNever`\<`MergeUnion`\<`TypeOf`\<`I`\>\>[`S`]\> extends `never` ? `never` : [`SortKeyCondition`](../index.md#sortkeycondition)\<`S`, `MergeUnion`\<`TypeOf`\<`I`\>\>[`S`]\> | Optional condition to specify how the partition will be queried. |

#### Returns

`Promise`\<[`TypeOf`\<`I`\>[], `L` extends `number` ? `undefined` \| `string` : `undefined`]\>

A tuple:
* [0] All of the items that could be queried with the conditions up to the `limit` (if set).
* [1] Either a `resumeKey` if there's more to query after reaching the `limit`, or undefined. It's always
undefined if `limit` is not set. **WARNING: The `resumeKey` is the LastEvaluatedKey returned by DynamoDB. It contains key 
attribute names and values from the DynamoDB table.**

**`Throws`**

InvalidResumeKeyError if the `resumeKey` parameter is invalid.

**`Throws`**

UnprocessedKeysError when OptimusDdbClient is unable to get DynamoDB to process one or more
keys while it is calling BatchGetItem (only relevant for GSIs that don't project the attributes defined
by the Table's itemSchema).

**`Throws`**

ItemValidationError if an item does not match the Table's `itemSchema`.

#### Defined in

[src/classes/OptimusDdbClient.ts:209](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/OptimusDdbClient.ts#L209)

___

### scanItems

▸ **scanItems**\<`I`, `P`, `S`, `L`\>(`params`): `Promise`\<[`TypeOf`\<`I`\>[], `L` extends `number` ? `undefined` \| `string` : `undefined`]\>

Scans items on the given Table or Gsi with the given conditions. It calls [the Scan DynamoDB API](
https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html) as many times as necessary to hit the 
specified limit or hit the end of the index. It may also call [the BatchGetItem DynamoDB API](
https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html) when it scans items from GSIs
that don't project the attributes defined by the Table's itemSchema.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `NonStripZodObject` \| `ZodUnion`\<[`NonStripZodObject`, ...NonStripZodObject[]]\> |
| `P` | extends `string` \| `number` \| `symbol` |
| `S` | extends `string` \| `number` \| `symbol` |
| `L` | extends `undefined` \| `number` = `undefined` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.filterCondition?` | [`FilterCondition`](../index.md#filtercondition)\<`MergeUnion`\<`TypeOf`\<`I`\>\>\> | Optional condition to filter items during the scan. |
| `params.index` | [`Table`](Table.md)\<`I`, `P`, `S`\> \| [`Gsi`](Gsi.md)\<`I`, `P`, `S`\> | The table or GSI to scan. |
| `params.invalidResumeKeyErrorOverride?` | (`e`: [`InvalidResumeKeyError`](InvalidResumeKeyError.md)) => `Error` | Optional parameter to override `InvalidResumeKeyError`. |
| `params.limit?` | `L` | Optional limit on the number of items to find before returning. |
| `params.resumeKey?` | `string` | Optional parameter to continue based on a `resumeKey` returned from an earlier `scanItems` call. |

#### Returns

`Promise`\<[`TypeOf`\<`I`\>[], `L` extends `number` ? `undefined` \| `string` : `undefined`]\>

A tuple:
* [0] All of the items that could be scanned with the conditions up to the `limit` (if set).
* [1] Either a `resumeKey` if there's more to scan after reaching the `limit`, or undefined. It's always
undefined if `limit` is not set. **WARNING: The `resumeKey` is the LastEvaluatedKey returned by DynamoDB. It contains key 
attribute names and values from the DynamoDB table.**

**`Throws`**

InvalidResumeKeyError if the `resumeKey` parameter is invalid.

**`Throws`**

UnprocessedKeysError when OptimusDdbClient is unable to get DynamoDB to process one or more
keys while it is calling BatchGetItem (only relevant for GSIs that don't project the attributes defined
by the Table's itemSchema).

**`Throws`**

ItemValidationError if an item does not match the Table's `itemSchema`.

#### Defined in

[src/classes/OptimusDdbClient.ts:267](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/classes/OptimusDdbClient.ts#L267)
