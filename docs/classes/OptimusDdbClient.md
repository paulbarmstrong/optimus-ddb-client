[optimus-ddb-client](../index.md) / OptimusDdbClient

# Class: OptimusDdbClient

Class to be used as a high level DynamoDB client. Consumers call various functions on their 
OptimusDdbClient to perform operations on items in their tables. Please see the README for more
high level information.

The overhead associated with an instance of OptimusDdbClient is similar to that of
DynamoDBDocumentClient from the AWS SDK (that's because OptimusDdbClient creates a 
DynamoDBDocumentClient).

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

[src/classes/OptimusDdbClient.ts:35](https://github.com/paulbarmstrong/optimus-ddb-client/blob/ad7ebcc/src/classes/OptimusDdbClient.ts#L35)

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

ItemShapeValidationError if an item does not match the Table's `itemShape`.

**`Throws`**

OptimisticLockError if the transaction is cancelled due to a conditional check failure.

#### Defined in

[src/classes/OptimusDdbClient.ts:278](https://github.com/paulbarmstrong/optimus-ddb-client/blob/ad7ebcc/src/classes/OptimusDdbClient.ts#L278)

___

### draftItem

▸ **draftItem**\<`I`, `P`, `S`\>(): `ShapeObjectToType`\<`I`\>

Drafts an item for creation. It does not call DynamoDB. The item is only
created in DynamoDB once it is included in the `items` of a call to `commitItems`.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `ShapeObject` |
| `P` | extends `string` \| `number` \| `symbol` |
| `S` | extends `string` \| `number` \| `symbol` |

#### Returns

`ShapeObjectToType`\<`I`\>

The drafted item.

**`Throws`**

ItemShapeValidationError if the item does not match the Table's `itemShape`.

#### Defined in

[src/classes/OptimusDdbClient.ts:54](https://github.com/paulbarmstrong/optimus-ddb-client/blob/ad7ebcc/src/classes/OptimusDdbClient.ts#L54)

___

### getItem

▸ **getItem**\<`I`, `P`, `S`, `E`\>(`params`): `Promise`\<`E` extends `Error` ? `ShapeObjectToType`\<`I`\> : `undefined` \| `ShapeObjectToType`\<`I`\>\>

Gets an item from the given Table with the given key. It calls [the GetItem DynamoDB API](
https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html).

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `ShapeObject` |
| `P` | extends `string` \| `number` \| `symbol` |
| `S` | extends `string` \| `number` \| `symbol` |
| `E` | extends `undefined` \| `Error` = `Error` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.itemNotFoundErrorOverride?` | (`e`: [`ItemNotFoundError`](ItemNotFoundError.md)) => `E` | Optional parameter to override `ItemNotFoundError`. If it returns `Error` then `getItem` will throw that error instead of `ItemNotFoundError`. If it returns `undefined` then `getItem` will return `undefined` instead of throwing `ItemNotFoundError`. |
| `params.key` | \{ [T in string \| number \| symbol]: ShapeToType\<I[P]\> } & \{ [T in string \| number \| symbol]: ShapeToType\<I[S]\> } | Key to look up. |
| `params.table` | [`Table`](Table.md)\<`I`, `P`, `S`\> | Table to look in. |

#### Returns

`Promise`\<`E` extends `Error` ? `ShapeObjectToType`\<`I`\> : `undefined` \| `ShapeObjectToType`\<`I`\>\>

The item with the given key (or `undefined` if the item is not found and 
`itemNotFoundErrorOverride` is set to a function that returns `undefined`).

**`Throws`**

ItemNotFoundError if the item is not found (and `itemNotFoundErrorOverride` is not set).

**`Throws`**

ItemShapeValidationError if the item does not match the Table's `itemShape`.

#### Defined in

[src/classes/OptimusDdbClient.ts:87](https://github.com/paulbarmstrong/optimus-ddb-client/blob/ad7ebcc/src/classes/OptimusDdbClient.ts#L87)

___

### getItemVersion

▸ **getItemVersion**(`params`): `number`

Gets an item's optimistic locking version number.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.item` | `Record`\<`string`, `any`\> | An item produced by DynamoDbClient |

#### Returns

`number`

The item's optimistic locking version number.

#### Defined in

[src/classes/OptimusDdbClient.ts:388](https://github.com/paulbarmstrong/optimus-ddb-client/blob/ad7ebcc/src/classes/OptimusDdbClient.ts#L388)

___

### getItems

▸ **getItems**\<`I`, `P`, `S`\>(`params`): `Promise`\<`ShapeObjectToType`\<`I`\>[]\>

Gets items from the given Table with the given keys. It calls [the BatchGetItem DynamoDB API](
https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html).

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `ShapeObject` |
| `P` | extends `string` \| `number` \| `symbol` |
| `S` | extends `string` \| `number` \| `symbol` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.itemNotFoundErrorOverride?` | (`e`: [`ItemNotFoundError`](ItemNotFoundError.md)) => `undefined` \| `Error` | Optional parameter to override `ItemNotFoundError`. If it returns `Error` then `getItems` will throw that error instead of `ItemNotFoundError`. If it returns `undefined` then `getItems` will omit the item from its response instead of throwing `ItemNotFoundError`. |
| `params.keys` | \{ [T in string \| number \| symbol]: ShapeToType\<I[P]\> } & \{ [T in string \| number \| symbol]: ShapeToType\<I[S]\> }[] | Keys to look up. The limit is 100. |
| `params.table` | [`Table`](Table.md)\<`I`, `P`, `S`\> | Table to look in. |

#### Returns

`Promise`\<`ShapeObjectToType`\<`I`\>[]\>

All of the items with the given keys (or just the items that were found if 
`itemNotFoundErrorOverride` is set to a function that returns `undefined`).

**`Throws`**

UnprocessedKeysError if there are any unprocessed keys.

**`Throws`**

ItemNotFoundError if one or more items are not found (and `itemNotFoundErrorOverride` is not set).

**`Throws`**

ItemShapeValidationError if an item does not match the Table's `itemShape`.

#### Defined in

[src/classes/OptimusDdbClient.ts:130](https://github.com/paulbarmstrong/optimus-ddb-client/blob/ad7ebcc/src/classes/OptimusDdbClient.ts#L130)

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

[src/classes/OptimusDdbClient.ts:69](https://github.com/paulbarmstrong/optimus-ddb-client/blob/ad7ebcc/src/classes/OptimusDdbClient.ts#L69)

___

### queryItems

▸ **queryItems**\<`I`, `P`, `S`, `L`\>(`params`): `Promise`\<[`ShapeObjectToType`\<`I`\>[], `L` extends `number` ? `undefined` \| `string` : `undefined`]\>

Querys items on the given Table or Gsi with the given conditions. It calls [the Query DynamoDB API](
https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html).

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `ShapeObject` |
| `P` | extends `string` \| `number` \| `symbol` |
| `S` | extends `string` \| `number` \| `symbol` |
| `L` | extends `undefined` \| `number` = `undefined` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.filterConditions?` | \{ [K in string \| number \| symbol]: FilterCondition\<K, ShapeToType\<I[K]\>\> }[`Exclude`\<`Exclude`\<keyof `I`, `P`\>, `S`\>][] | Optional list of conditions to filter down the results. |
| `params.index` | [`Table`](Table.md)\<`I`, `P`, `S`\> \| [`Gsi`](Gsi.md)\<`I`, `P`, `S`\> | The table or GSI to query. |
| `params.invalidNextTokenErrorOverride?` | (`e`: [`InvalidNextTokenError`](InvalidNextTokenError.md)) => `Error` | Optional parameter to override `InvalidNextTokenError`. |
| `params.limit?` | `L` | Optional limit on the number of items to find before returning. |
| `params.nextToken?` | `string` | Optional parameter to continue based on a nextToken returned from an earlier `queryItems` call. |
| `params.partitionKeyCondition` | [`PartitionKeyCondition`](../index.md#partitionkeycondition)\<`P`, `ShapeToType`\<`I`[`P`]\>\> | Condition to specify which partition the Query will take place in. |
| `params.scanIndexForward?` | `boolean` | Optional parameter used to switch the order of the query. |
| `params.sortKeyCondition?` | `AnyToNever`\<`ShapeToType`\<`I`[`S`]\>\> extends `never` ? `never` : [`SortKeyCondition`](../index.md#sortkeycondition)\<`S`, `ShapeToType`\<`I`[`S`]\>\> | Optional condition to specify how the partition will be queried. |

#### Returns

`Promise`\<[`ShapeObjectToType`\<`I`\>[], `L` extends `number` ? `undefined` \| `string` : `undefined`]\>

A tuple:
* [0] All of the items that could be queried with the conditions up to the `limit` (if set).
* [1] Either a nextToken if there's more to query after reaching the `limit`, or undefined. It's always
undefined if `limit` is not set.

**`Throws`**

InvalidNextTokenError if the nextToken parameter is invalid.

**`Throws`**

ItemShapeValidationError if an item does not match the Table's `itemShape`.

#### Defined in

[src/classes/OptimusDdbClient.ts:181](https://github.com/paulbarmstrong/optimus-ddb-client/blob/ad7ebcc/src/classes/OptimusDdbClient.ts#L181)

___

### scanItems

▸ **scanItems**\<`I`, `P`, `S`, `L`\>(`params`): `Promise`\<[`ShapeObjectToType`\<`I`\>[], `L` extends `number` ? `undefined` \| `string` : `undefined`]\>

Scans items on the given Table or Gsi with the given conditions. It calls [the Scan DynamoDB API](
https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html).

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends `ShapeObject` |
| `P` | extends `string` \| `number` \| `symbol` |
| `S` | extends `string` \| `number` \| `symbol` |
| `L` | extends `undefined` \| `number` = `undefined` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | - |
| `params.filterConditions?` | \{ [K in string \| number \| symbol]: FilterCondition\<K, ShapeToType\<I[K]\>\> }[keyof `I`][] | Optional list of conditions to filter down the results. |
| `params.index` | [`Table`](Table.md)\<`I`, `P`, `S`\> \| [`Gsi`](Gsi.md)\<`I`, `P`, `S`\> | The table or GSI to scan. |
| `params.invalidNextTokenErrorOverride?` | (`e`: [`InvalidNextTokenError`](InvalidNextTokenError.md)) => `Error` | Optional parameter to override `InvalidNextTokenError`. |
| `params.limit?` | `L` | Optional limit on the number of items to find before returning. |
| `params.nextToken?` | `string` | Optional parameter to continue based on a nextToken returned from an earlier `scanItems` call. |

#### Returns

`Promise`\<[`ShapeObjectToType`\<`I`\>[], `L` extends `number` ? `undefined` \| `string` : `undefined`]\>

A tuple:
* [0] All of the items that could be scanned with the conditions up to the `limit` (if set).
* [1] Either a nextToken if there's more to scan after reaching the `limit`, or undefined. It's always
undefined if `limit` is not set.

**`Throws`**

InvalidNextTokenError if the nextToken parameter is invalid.

**`Throws`**

ItemShapeValidationError if an item does not match the Table's `itemShape`.

#### Defined in

[src/classes/OptimusDdbClient.ts:236](https://github.com/paulbarmstrong/optimus-ddb-client/blob/ad7ebcc/src/classes/OptimusDdbClient.ts#L236)
