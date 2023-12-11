import DynamoDbLocal from "dynamodb-local"
import { DYNAMO_DB_LOCAL_PORT } from "./Constants"

export default function() {
	DynamoDbLocal.stop(DYNAMO_DB_LOCAL_PORT)
}
