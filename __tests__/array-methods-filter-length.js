import {Immer, enableArrayMethods} from "../src/immer"
import {clearPlugin, PluginArrayMethods} from "../src/internal"

for (const enabled of [false, true]) {
	for (const autoFreeze of [false, true]) {
		describe(`filter length: plugin=${enabled}, autoFreeze=${autoFreeze}`, () => {
			beforeEach(() => {
				if (enabled) enableArrayMethods()
				else clearPlugin(PluginArrayMethods)
			})
			afterEach(() => clearPlugin(PluginArrayMethods))

			test("does not visit items appended by the predicate", () => {
				const {produce} = new Immer({autoFreeze})
				const base = [1, 2]
				const visited = []
				const result = produce(base, draft => {
					draft.push(3)
					const filtered = draft.filter((value, index) => {
						visited.push(index)
						if (index === 0) draft.push(4)
						return true
					})
					expect(filtered).toEqual([1, 2, 3])
				})
				expect(visited).toEqual([0, 1, 2])
				expect(result).toEqual([1, 2, 3, 4])
				expect(base).toEqual([1, 2])
			})
		})
	}
}
