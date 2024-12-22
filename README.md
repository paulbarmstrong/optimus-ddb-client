## optimus-ddb-client

### About

OptimusDdbClient is a TypeScript/JavaScript DynamoDB client with the following abstractions:
 * **JavaScript attribute types instead of DynamoDB JSON.** Your items' attributes are represented by JavaScript types like `number` and `string` instead of DynamoDB JSON.
 * **Strong typing.** All items, key parameters, and query conditions are statically typed for each table's specific indexes and items. Runtime type validation is performed when pulling items out of DynamoDB and committing items into DynamoDB.
 * **Built-in transactions and optimistic locking.** An abstracted version number attribute facilitates optimistic locking. When you commit changes OptimusDdbClient does a TransactWriteItems with the items' version attribute values as conditions of the transaction. That guarentees that either all of the items in the transaction change exactly as they did in your code, or the transaction is cancelled and OptimusDdbClient throws an error.
 * **Managed expressions.** Instead of a string, expression name mappings, and expression value mappings, OptimusDdbClient's Query and Scan conditions are specified with statically typed tuples. Because of that you can be confident that your conditions are valid and you don't have to worry about mapping expression names and expression values.
 * **Table relationships.** When you specify a relationship between two tables, OptimusDdbClient will make sure that any item changes made on those tables must not violate the relationship. If a commitItems call does not include the items necessary to transactionally maintain all tables' relationships, it will throw a TableRelationshipViolationError. One-to-one, one-to-many, and many-to-many relationships are supported.
 * **No size limits for BatchGetItem, Query, or Scan.** OptimusDdbClient's getItems method will call BatchGetItem until all requested items are fetched. OptimusDdbClient's queryItems and scanItems methods will call Query or Scan respectively until the optional limit you specify is reached or it hits the end of the index.

### Requirements

1. Any existing items of tables to be used with OptimusDdbClient should have an N attribute to use for optimistic locking. It should be specified in the `Table` constructor's `versionAttribute` parameter. The default is "version".

### Installation
```
npm install optimus-ddb-client zod
```
[`zod`](https://www.npmjs.com/package/zod) is a peer dependency of `optimus-ddb-client`

### Usage
```javascript
import { Table, OptimusDdbClient } from "optimus-ddb-client"
import * as z from "zod"

// Create Table class instances based on your DynamoDB tables.
const blogPostsTable = new Table({
	tableName: "BlogPosts",
	itemSchema: z.strictObject({
		id: z.string(),
		name: z.string(),
		content: z.string(),
		numComments: z.number().int()
	}),
	partitionKey: "id"
})
const commentsTable = new Table({
	tableName: "Comments",
	itemSchema: z.strictObject({
		blogPostId: z.string(),
		id: z.string(),
		content: z.string()
	}),
	partitionKey: "blogPostId",
	sortKey: "id"
})

const optimus = new OptimusDdbClient()

// Perform operations on items in those tables.
// Example scenario - Handling an API request for adding a comment to a blog post:
async function handleCreateBlogPostComment(blogPostId, commentContent) {
	// Get the blog post
	const blogPost = await optimus.getItem({
		table: blogPostsTable,
		key: { id: blogPostId }
	})

	// Prepare a change to increase the blog post's numComments.
	blogPost.numComments = blogPost.numComments + 1

	// Prepare a new comment.
	const comment = optimus.draftItem({
		table: commentsTable,
		item: {
			blogPostId: blogPostId,
			id: crypto.randomUUID(),
			content: commentContent
		}
	})

	// Commit those changes in a transaction.
	await optimus.commitItems({ items: [blogPost, comment] })

	return { id: comment.id }
}
```

In TypeScript use zod's infer function to get a named type for your items
```typescript
import * as z from "zod"

type BlogPost = z.infer<typeof blogPostsTable.itemSchema>
const blogPost: BlogPost = await optimus.getItem({
	table: blogPostsTable,
	key: { id: blogPostId }
})
```

Please see [the unit test demonstrating this example](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/tst/README.test.ts).

### Tests

The GitHub repo's tst directory has unit tests and integ tests using DynamoDB local. You can run the tests by cloning the repo and running `npm install` then `npm run test`. You need to have java installed to run the tests because DynamoDB local requires java.

### Documentation

Please see [the low level documentation](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/docs/index.md) for more details.
