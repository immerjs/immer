import {Immer, enableMapSet, enablePatches, isDraft} from "../src/immer"

enableMapSet()
enablePatches()

const keys = [
	["undefined", undefined],
	["null", null],
	["boolean", false],
	["number", 0],
	["NaN", NaN],
	["bigint", 1n],
	["string", "key"],
	["symbol", Symbol("key")],
	["object", {}],
	["array", ["key"]]
]

describe.each([false, true])("Map keys with autoFreeze=%s", autoFreeze => {
	const immer = new Immer({autoFreeze})

	test.each([
		[
			"object",
			() => ({count: 0}),
			value => {
				value.count++
			},
			{count: 1}
		],
		[
			"array",
			() => [0],
			value => {
				value.push(1)
			},
			[0, 1]
		],
		[
			"Map",
			() => new Map([["count", 0]]),
			value => {
				value.set("count", 1)
			},
			new Map([["count", 1]])
		],
		[
			"Set",
			() => new Set([0]),
			value => {
				value.add(1)
			},
			new Set([0, 1])
		]
	])(
		"finalizes an undefined-keyed %s value",
		(_name, createValue, update, expected) => {
			const value = createValue()
			const base = new Map([[undefined, value]])
			const next = immer.produce(base, draft => {
				update(draft.get(undefined))
			})

			expect(next.get(undefined)).toEqual(expected)
			expect(next.get(undefined)).not.toBe(value)
			expect(isDraft(next.get(undefined))).toBe(false)
			expect(base.get(undefined)).toEqual(createValue())
		}
	)

	test("preserves an unchanged undefined-keyed value when another entry changes", () => {
		const value = {count: 0}
		const base = new Map([
			[undefined, value],
			["other", {count: 0}]
		])
		const next = immer.produce(base, draft => {
			void draft.get(undefined)
			draft.get("other").count++
		})

		expect(next.get(undefined)).toBe(value)
		expect(next.get("other").count).toBe(1)
		expect(base.get("other").count).toBe(0)
	})

	describe.each([false, true])("patches with nested Map=%s", nested => {
		test.each(keys)(
			"replays and reverses changes through a %s key",
			(_name, key) => {
				const map = new Map([[key, {count: 0}]])
				if (typeof key !== "string") map.set(String(key), {count: 10})
				const base = nested ? {map} : map
				const getMap = value => (nested ? value.map : value)
				const [next, patches, inverse] = immer.produceWithPatches(
					base,
					draft => {
						getMap(draft).get(key).count++
					}
				)
				const path = nested ? ["map", key, "count"] : [key, "count"]

				expect(getMap(next).get(key).count).toBe(1)
				expect(map.get(key).count).toBe(0)
				expect(patches).toEqual([{op: "replace", path, value: 1}])
				expect(inverse).toEqual([{op: "replace", path, value: 0}])
				expect(patches[0].path[nested ? 1 : 0]).toBe(key)
				expect(immer.applyPatches(base, patches)).toEqual(next)
				expect(immer.applyPatches(next, inverse)).toEqual(base)
				if (typeof key !== "string") {
					expect(getMap(next).get(String(key))).toBe(map.get(String(key)))
				}
			}
		)
	})

	test.each(["add", "replace", "remove"])(
		"preserves an array key in %s patches",
		op => {
			const key = ["category", "item"]
			const base = op === "add" ? new Map() : new Map([[key, {count: 0}]])
			const [next, patches, inverse] = immer.produceWithPatches(base, draft => {
				if (op === "remove") draft.delete(key)
				else draft.set(key, {count: 1})
			})

			expect(patches).toHaveLength(1)
			expect(patches[0].op).toBe(op)
			expect(patches[0].path).toEqual([key])
			expect(patches[0].path[0]).toBe(key)
			expect(immer.applyPatches(base, patches)).toEqual(next)
			expect(immer.applyPatches(next, inverse)).toEqual(base)
		}
	)

	test.each(["remove", "replace"])(
		"does not reattach an undefined-keyed child after %s",
		op => {
			const base = new Map([[undefined, {count: 0}]])
			const [next, patches, inverse] = immer.produceWithPatches(base, draft => {
				const child = draft.get(undefined)
				if (op === "remove") draft.delete(undefined)
				else draft.set(undefined, {count: 2})
				child.count = 1
			})

			expect(next).toEqual(
				op === "remove" ? new Map() : new Map([[undefined, {count: 2}]])
			)
			expect(patches).toHaveLength(1)
			expect(patches[0].path).toEqual([undefined])
			expect(immer.applyPatches(base, patches)).toEqual(next)
			expect(immer.applyPatches(next, inverse)).toEqual(base)
		}
	)

	test.each([["__proto__"], ["constructor", "prototype"]])(
		"rejects reserved object attributes below a Map key: %s",
		(...attributes) => {
			const key = {}
			const base = new Map([[key, {}]])

			expect(() =>
				immer.applyPatches(base, [
					{op: "add", path: [key, ...attributes, "polluted"], value: true}
				])
			).toThrow()
			expect({}.polluted).toBeUndefined()
		}
	)
})
