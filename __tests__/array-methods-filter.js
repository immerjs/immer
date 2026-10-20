import {Immer, enableArrayMethods} from "../src/immer"
import {clearPlugin, PluginArrayMethods} from "../src/internal"

for (const useArrayMethods of [false, true]) {
	for (const autoFreeze of [false, true]) {
		describe(`array methods: plugin=${useArrayMethods}, autoFreeze=${autoFreeze}`, () => {
			const {produce} = new Immer({autoFreeze})
			beforeEach(() => {
				if (useArrayMethods) enableArrayMethods()
				else clearPlugin(PluginArrayMethods)
			})
			afterEach(() => clearPlugin(PluginArrayMethods))
			test("skips holes but visits explicit undefined values", () => {
				const items = new Array(5)
				items[1] = {value: 10}
				items[3] = undefined
				const visited = []
				const base = {items}
				const result = produce(base, draft => {
					const filtered = draft.items.filter((item, index) => {
						visited.push(index)
						return true
					})
					expect(visited).toEqual([1, 3])
					expect(filtered).toHaveLength(2)
					expect(filtered[1]).toBeUndefined()
					filtered[0].value = 20
				})
				expect(result.items[1].value).toBe(20)
				expect(base.items[1].value).toBe(10)
				expect(Object.keys(result.items)).toEqual(["1", "3"])
			})

			test("does not call the filter predicate for an entirely sparse array", () => {
				const base = new Array(3)
				const predicate = vi.fn(() => true)
				const result = produce(base, draft => {
					expect(draft.filter(predicate)).toEqual([])
				})
				expect(predicate).not.toHaveBeenCalled()
				expect(result).toBe(base)
			})
		})
	}
}
