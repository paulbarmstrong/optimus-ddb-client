import { QueryCommandInput, QueryCommandOutput, ScanCommandInput, ScanCommandOutput } from "@aws-sdk/lib-dynamodb"

export class ItemsPagesIterator {
    #params
    #started: boolean
    items: Array<Record<string, any>>
	lastEvaluatedKey: Record<string, any> | undefined
    constructor(params: {
        commandInput: QueryCommandInput | ScanCommandInput,
        get: (input: QueryCommandInput | ScanCommandInput) => Promise<QueryCommandOutput | ScanCommandOutput>,
        limit: number | undefined,
        lastEvaluatedKey: Record<string, any> | undefined
    }) {
        this.#params = params
        this.#started = false
        this.items = []
        this.lastEvaluatedKey = params.lastEvaluatedKey
    }

    hasNext() {
        return !this.#started || (this.lastEvaluatedKey !== undefined && !(this.#params.limit !== undefined && this.items.length === this.#params.limit))
    }
    
    async next(): Promise<Array<Record<string,any>>> {
        this.#started = true
        const res = await this.#params.get({
			...this.#params.commandInput,
			ExclusiveStartKey: this.lastEvaluatedKey,
			Limit: this.#params.limit !== undefined ? this.#params.limit - this.items.length : undefined
		})
		this.items.push(...res.Items!)
		this.lastEvaluatedKey = res.LastEvaluatedKey
        return res.Items!
    }
}