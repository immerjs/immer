import {measure} from "./measure"
import produce, {
	setUseProxies,
	setUseStrictShallowCopy,
	enableAllPlugins
} from "../dist/immer.cjs.production.min.js"

enableAllPlugins()

console.log("\n# large-obj - mutate large object\n")

const MAX = 50

const baseState = Object.fromEntries(
	Array(10000)
		.fill(0)
		.map((_, i) => [i, i])
)

measure("immer (proxy) - with setUseStrictShallowCopy", () => {
	setUseStrictShallowCopy(true)
	setUseProxies(true)

	for (let i = 0; i < MAX; i++) {
		produce(baseState, draft => {
			draft[5000]++
		})
	}
})

measure("immer (proxy) - without setUseStrictShallowCopy", () => {
	setUseStrictShallowCopy(false)
	setUseProxies(true)

	for (let i = 0; i < MAX; i++) {
		produce(baseState, draft => {
			draft[5000]++
		})
	}
})

measure("immer (es5) - with setUseStrictShallowCopy", () => {
	setUseStrictShallowCopy(true)
	setUseProxies(false)

	for (let i = 0; i < MAX; i++) {
		produce(baseState, draft => {
			draft[5000]++
		})
	}
})

measure("immer (es5) - without setUseStrictShallowCopy", () => {
	setUseStrictShallowCopy(false)
	setUseProxies(false)

	for (let i = 0; i < MAX; i++) {
		produce(baseState, draft => {
			draft[5000]++
		})
	}
})
