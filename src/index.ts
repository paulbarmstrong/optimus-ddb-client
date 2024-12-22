/**
 * This is low level documentation. Please see [README.md](../README.md) for the high level documentation.
 * @module optimus-ddb-client
 */

export { Gsi } from "./classes/Gsi"
export { OptimusDdbClient } from "./classes/OptimusDdbClient"
export { Table } from "./classes/Table"
export { UnprocessedKeysError, ItemNotFoundError, OptimisticLockError, InvalidResumeKeyError, ItemValidationError,
	TableRelationshipViolationError, PartitionKeyCondition, SortKeyCondition, FilterCondition, TableRelationshipType
} from "./Types"
