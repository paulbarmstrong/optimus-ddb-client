import DynamoDbLocal from "dynamodb-local"
import { DYNAMO_DB_LOCAL_CLIENT_CONFIG, DYNAMO_DB_LOCAL_PORT } from "./Constants"
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb"

export default async function() {
	await DynamoDbLocal.launch(DYNAMO_DB_LOCAL_PORT, null, [], false, true)
	const dynamoDb = new DynamoDBClient(DYNAMO_DB_LOCAL_CLIENT_CONFIG)
	while (true) {
		try {
			await dynamoDb.send(new ListTablesCommand({}))
			return
		} catch (error) {}
	}
}