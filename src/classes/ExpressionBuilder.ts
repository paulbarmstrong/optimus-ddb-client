export class ExpressionBuilder {
	#attributeNames: Map<string, string>
	#attributeValues: Map<string, any>
	constructor() {
		this.#attributeNames = new Map<string, string>
		this.#attributeValues = new Map<string, any>
	}
	addName(name: string) {
		return this.#add(name, this.#attributeNames, "#")
	}
	addValue(value: any) {
		return this.#add(value, this.#attributeValues, ":")
	}
	get attributeNames() {
		return Object.fromEntries(this.#attributeNames.entries())
	}
	get attributeValues() {
		return Object.fromEntries(this.#attributeValues.entries())
	}
	#add(content: any, map: Map<string, any>, prefix: "#" | ":") {
		const almostSanitized = content.toString()
			.replace(/[^A-Za-z0-9_]/g, "_")
			.substring(0, 16)
		const sanitizedContent = /^[A-Za-z]/.test(almostSanitized) ? almostSanitized : `A${almostSanitized}`
		let i = 0
		while (map.has(`${prefix}${sanitizedContent}_${i}`)) i++
		const alias = `${prefix}${sanitizedContent}_${i}`
		map.set(alias, content)
		return alias
	}
}