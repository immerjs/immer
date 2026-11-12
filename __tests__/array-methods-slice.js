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
			test("distinguishes null end from omitted or undefined end", () => {
				const base = {items: [{id: 1}, {id: 2}, {id: 3}]}
				const result = produce(base, draft => {
					for (const args of [
						[0, null],
						[1, null],
						[-2, null],
						[null, null],
						[0],
						[0, undefined]
					]) {
						expect(draft.items.slice(...args).map(item => item.id)).toEqual(
							base.items.slice(...args).map(item => item.id)
						)
					}
				})
				expect(result).toBe(base)
			})
		})
	}
}
