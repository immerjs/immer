import {Immer, enableArrayMethods} from "../src/immer"
import {clearPlugin, PluginArrayMethods} from "../src/internal"

const cases = [
	[NaN],
	[1.5],
	[0.5],
	[0, 1.5],
	[0.5, 3.5],
	[-1.5],
	[0, -1.5],
	["1"],
	[0, "2"],
	[Infinity],
	[-Infinity]
].map(args => [
	args.map(value => (Number.isNaN(value) ? "NaN" : String(value))).join(", "),
	args
])

for (const useArrayMethods of [false, true]) {
	for (const autoFreeze of [false, true]) {
		describe(`slice index coercion: plugin=${useArrayMethods}, autoFreeze=${autoFreeze}`, () => {
			const {produce} = new Immer({autoFreeze})
			beforeEach(() => {
				if (useArrayMethods) enableArrayMethods()
				else clearPlugin(PluginArrayMethods)
			})
			afterEach(() => clearPlugin(PluginArrayMethods))

			test.each(cases)("matches native slice(%s)", (_label, args) => {
				const base = [1, 2, 3, 4]
				let sliced
				const result = produce(base, draft => {
					sliced = draft.slice(...args).map(value => value)
				})
				expect(sliced).toEqual(base.slice(...args))
				expect(result).toBe(base)
			})
		})
	}
}
