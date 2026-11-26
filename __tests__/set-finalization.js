import {Immer, enableMapSet, isDraft} from "../src/immer"

enableMapSet()

describe.each([false, true])("returned Sets with autoFreeze=%s", autoFreeze => {
	const immer = new Immer({autoFreeze})

	test.each([false, true])("finalizes draft entries, nested=%s", nested => {
		const first = {id: 1}
		const second = {id: 2}
		const base = {first, second}
		const result = immer.produce(base, draft => {
			const items = new Set([
				"before",
				draft.first,
				"middle",
				draft.second,
				"after"
			])
			return nested ? {items} : items
		})
		const items = nested ? result.items : result
		expect([...items]).toEqual(["before", first, "middle", second, "after"])
		expect(items.size).toBe(5)
		expect([...items][1]).toBe(first)
		expect([...items].some(isDraft)).toBe(false)
		expect(base).toEqual({first: {id: 1}, second: {id: 2}})
	})

	test.each([{values: []}, {values: [1, 2, 3]}])(
		"keeps non-draft contents $values",
		({values}) => {
			const result = immer.produce({}, () => new Set(values))
			expect([...result]).toEqual(values)
		}
	)
})
