import * as z from "zod"
import { Table } from "../src"
import crypto from "crypto"
import { prepDdbTest } from "./test-utilities/DynamoDb"
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb"

test("Example from README", async () => {
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

	// Perform operations on items in those tables.
	// Example scenario - Handling an API request for adding a comment to a blog post:
	async function handleCreateBlogPostComment(blogPostId: string, commentContent: string) {
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

	const createCommentRes = await handleCreateBlogPostComment(blogPostId, "Nice blog post")

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