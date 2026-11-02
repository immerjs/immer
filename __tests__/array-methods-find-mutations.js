import {Immer, enableArrayMethods} from "../src/immer"
import {clearPlugin, PluginArrayMethods} from "../src/internal"

for (const enabled of [false, true]) {
	for (const autoFreeze of [false, true]) {
		describe(`find mutations: plugin=${enabled}, autoFreeze=${autoFreeze}`, () => {
			beforeEach(() => {
				if (enabled) enableArrayMethods()
				else clearPlugin(PluginArrayMethods)
			})
			afterEach(() => clearPlugin(PluginArrayMethods))

			for (const method of ["find", "findLast"]) {
				test(`${method} observes replacements made by its predicate`, () => {
					const {produce} = new Immer({autoFreeze})
					const base = [{id: 1}, {id: 2}]
					const first = method === "find" ? 0 : 1
					const target = 1 - first
					const seen = []
					const result = produce(base, draft => {
						const found = draft[method]((value, index) => {
							seen.push(value.id)
							if (index === first) draft[target] = {id: 9}
							return value.id === 9
						})
						expect(found).toBe(draft[target])
						expect(found.id).toBe(9)
					})
					expect(seen).toEqual([first + 1, 9])
					expect(result[target]).toEqual({id: 9})
					expect(base).toEqual([{id: 1}, {id: 2}])
				})
			}
		})
	}
}
