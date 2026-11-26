import {Immer, enablePatches, immerable} from "../src/immer"

enablePatches()

describe.each([false, true])(
	"symbol patch paths (autoFreeze: %s)",
	autoFreeze => {
		it.each(["object", "class"])(
			"replays and reverses nested changes through a symbol on an %s",
			kind => {
				const key = Symbol("constructor")
				class Box {
					[immerable] = true
					constructor() {
						Object.defineProperty(this, key, {value: {count: 0}})
					}
				}
				const api = new Immer({autoFreeze, useStrictShallowCopy: true})
				const base = kind === "class" ? new Box() : {[key]: {count: 0}}
				const [next, patches, inverse] = api.produceWithPatches(base, draft => {
					draft[key].count = 1
				})

				expect(patches).toEqual([
					{op: "replace", path: [key, "count"], value: 1}
				])
				const replay = api.applyPatches(base, patches)
				expect(replay[key].count).toBe(next[key].count)
				expect(api.applyPatches(replay, inverse)[key].count).toBe(0)
				expect(base[key].count).toBe(0)
				expect(Object.getPrototypeOf(replay)).toBe(Object.getPrototypeOf(base))
			}
		)

		it("preserves distinct symbols with the same description in a nested path", () => {
			const first = Symbol("child")
			const second = Symbol("child")
			const api = new Immer({autoFreeze})
			const base = {nested: {[first]: {count: 0}, [second]: {count: 10}}}
			const [next, patches, inverse] = api.produceWithPatches(base, draft => {
				draft.nested[first].count = 1
			})

			const replay = api.applyPatches(base, patches)
			expect(replay.nested[first].count).toBe(next.nested[first].count)
			expect(replay.nested[second]).toBe(base.nested[second])
			expect(api.applyPatches(replay, inverse).nested[first].count).toBe(0)
			expect(base.nested[first].count).toBe(0)
		})
	}
)
