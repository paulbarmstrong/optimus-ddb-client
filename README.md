## optimus-ddb-client

### Notice
Please note this package is still experimental so breaking changes may be made without notice.

### About
OptimusDdbClient is a high level TypeScript/JavaScript DynamoDB client focused on strong typing and transactional consistency.

Consumers specify the indexes of their tables and the shapes of items in their tables. OptimusDdbClient uses those specifications to provide the strongest possible typing for operations on those tables. All items, key parameters, and query expressions are fully typed for each table's specific indexes and items.

An abstracted version number attribute facilitates optimistic locking. When consumers commit their changes OptimusDdbClient does a TransactWriteItems with the items' version attribute values as conditions of the transaction. That guarentees that either all of the items in the transaction change exactly as they did in the consumer's code, or the transaction will be cancelled and OptimusDdbClient throws an error.

### Requirements

1. Any existing items of tables to be used with OptimusDdbClient should have an N attribute to use for optimistic locking. It should be specified in the `Table` constructor's `versionAttribute` parameter. The default is "version".
2. GSIs to be used with OptimusDdbClient should have all attributes projected.

### Installation
```
npm install optimus-ddb-client shape-tape
```
`shape-tape` is a peer dependency of `optimus-ddb-client`

### Usage
```javascript
import { Table, OptimusDdbClient } from "optimus-ddb-client"
import { s } from "shape-tape"

// Create Table class instances based on your DynamoDB tables.
const blogPostsTable = new Table({
	tableName: "BlogPosts",
	itemShape: s.object({
		id: s.string(),
		name: s.string(),
		content: s.string(),
		numComments: s.integer()
	}),
	partitionKey: "id"
})
const commentsTable = new Table({
	tableName: "Comments",
	itemShape: s.object({
		blogPostId: s.string(),
		id: s.string(),
		content: s.string()
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

If you're using TypeScript you can get named types for your items.
```typescript
import { ShapeToType } from "shape-tape"

type BlogPost = ShapeToType<typeof blogPostsTable.itemShape>
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
