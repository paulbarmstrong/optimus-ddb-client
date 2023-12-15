import { s } from "shape-tape"
import { Table } from "../../../src"
import { prepDdbTest } from "../../test-utilities/DynamoDb"
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb"

test("README example", async () => {
	// Create Table class instances based on your DynamoDB tables.
	const blogPostsTable = new Table({
		tableName: "BlogPosts",
		itemShape: s.dictionary({
			id: s.string(),
			name: s.string(),
			content: s.string(),
			numComments: s.integer()
		}),
		partitionKey: "id"
	})
	const commentsTable = new Table({
		tableName: "Comments",
		itemShape: s.dictionary({
			blogPostId: s.string(),
			id: s.string(),
			content: s.string()
		}),
		partitionKey: "blogPostId",
		sortKey: "id"
	})

		// Perform operations on items in those tables.
	// Example scenario - Handling an API request for adding a comment to a blog post:
	async function handleCreateBlogPostComment(body: { blogPostId: string, commentContent: string }) {
		// Get the blog post and handle the case where it doesn't exist.
		const blogPost = await optimus.getItem({
			table: blogPostsTable,
			key: { id: body.blogPostId },
			itemNotFoundErrorOverride: _ => new Error("Blog post not found!")
		})

		// Prepare a change to increase the blog post's numComments.
		blogPost.numComments = blogPost.numComments + 1

		// Prepare a new comment.
		const commentId = crypto.randomUUID()
		const comment = optimus.draftItem({
			table: commentsTable,
			item: {
				blogPostId: body.blogPostId,
				id: commentId,
				content: body.commentContent
			}
		})

		// Commit those changes in a transaction.
		await optimus.commitItems({ items: [blogPost, comment] })

		return { id: commentId }
	}

	const [optimus, ddbDocumentClient] = await prepDdbTest([blogPostsTable, commentsTable], [])
	const blogPostId = crypto.randomUUID()
	await ddbDocumentClient.send(new PutCommand({
		TableName: "BlogPosts",
		Item: {
			id: blogPostId,
			name: "My blog post",
			content: "This is my blog post",
			numComments: 0,
			version: 0
		}
	}))

	const createCommentRes = await handleCreateBlogPostComment({ blogPostId: blogPostId, commentContent: "Nice blog post" })

	const blogPostItem = (await ddbDocumentClient.send(new GetCommand({
		TableName: "BlogPosts",
		Key: { id: blogPostId }
	}))).Item
	const commentItem = (await ddbDocumentClient.send(new GetCommand({
		TableName: "Comments",
		Key: {
			blogPostId: blogPostId,
			id: createCommentRes.id
		}
	}))).Item
	expect(blogPostItem).toStrictEqual({
		id: blogPostId,
		name: "My blog post",
		content: "This is my blog post",
		numComments: 1,
		version: 1
	})
	expect(commentItem).toStrictEqual({
		blogPostId: blogPostId,
		id: createCommentRes.id,
		content: "Nice blog post",
		version: 0
	})
})
