import {measure} from "./measure"
import {
	produce,
	setUseStrictShallowCopy
} from "../dist/immer.cjs.production.min.js"

console.log("\n# large-obj - mutate large object\n")

const MAX = 50

const baseState = Object.fromEntries(
	Array(10000)
		.fill(0)
		.map((_, i) => [i, i])
)

measure("immer - with setUseStrictShallowCopy", () => {
	setUseStrictShallowCopy(true)

	for (let i = 0; i < MAX; i++) {
		produce(baseState, draft => {
			draft[5000]++
		})
	}
})

measure("immer - without setUseStrictShallowCopy", () => {
	setUseStrictShallowCopy(false)

	for (let i = 0; i < MAX; i++) {
		produce(baseState, draft => {
			draft[5000]++
		})
	}
})
