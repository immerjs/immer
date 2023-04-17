"use strict"
import {
	Immer,
	nothing,
	original,
	isDraft,
	immerable,
	enablePatches,
	enableMapSet
} from "../src/immer"
import {each, shallowCopy, isEnumerable, DRAFT_STATE} from "../src/utils/common"

enableMapSet()
enablePatches()

jest.setTimeout(1000)

runBaseTest("proxy (no freeze)", true, false)
runBaseTest("proxy (autofreeze)", true, true)
runBaseTest("proxy (autofreeze)(patch listener)", true, true, true)

function runBaseTest(name, autoFreeze, useListener) {
	const listener = useListener ? function() {} : undefined
	const {produce, produceWithPatches} = createPatchedImmer({
		autoFreeze
	})

	// When `useListener` is true, append a function to the arguments of every
	// uncurried `produce` call in every test. This makes tests easier to read.
	function createPatchedImmer(options) {
		const immer = new Immer(options)

		const {produce} = immer
		immer.produce = function(...args) {
			return typeof args[1] === "function" && args.length < 3
				? produce(...args, listener)
				: produce(...args)
		}

		return immer
	}

	describe("map issues " + name, () => {
		test("#472 ", () => {
			const project = produce(new Map(), draft => {
				draft.set("bar1", {blocked: false})
				draft.set("bar2", {blocked: false})
			})

			// Read before write -- no error
			produce(project, draft => {
				const bar1 = draft.get("bar1")
				const bar2 = draft.get("bar2")
				bar1.blocked = true
				bar2.blocked = true
			})

			// Read/write interleaved -- error
			produce(project, draft => {
				const bar1 = draft.get("bar1")
				bar1.blocked = true
				const bar2 = draft.get("bar2")
				bar2.blocked = true // TypeError: "blocked" is read-only
			})
		})

		test("#466 - setNoPatches", () => {
			const obj = {
				set: new Set()
			}

			const result = produceWithPatches(obj, draft => {
				draft.set.add("abc")
			})
			expect(result).toEqual([
				{set: new Set(["abc"])},
				[{op: "add", path: ["set", 0], value: "abc"}],
				[{op: "remove", path: ["set", 0], value: "abc"}]
			])
		})

		test("#466 - mapChangeBug ", () => {
			const obj = {
				map: new Map([
					[
						"a",
						new Map([
							["b", true],
							["c", true],
							["d", true]
						])
					],
					["b", new Map([["a", true]])],
					["c", new Map([["a", true]])],
					["d", new Map([["a", true]])]
				])
			}
			const result = produceWithPatches(obj, draft => {
				const aMap = draft.map.get("a")
				aMap.forEach((_, other) => {
					const otherMap = draft.map.get(other)
					otherMap.delete("a")
				})
			})
			expect(result).toEqual([
				{
					map: new Map([
						[
							"a",
							new Map([
								["b", true],
								["c", true],
								["d", true]
							])
						],
						["b", new Map()],
						["c", new Map()],
						["d", new Map()]
					])
				},
				[
					{
						op: "remove",
						path: ["map", "b", "a"]
					},
					{
						op: "remove",
						path: ["map", "c", "a"]
					},
					{
						op: "remove",
						path: ["map", "d", "a"]
					}
				],
				[
					{
						op: "add",
						path: ["map", "b", "a"],
						value: true
					},
					{
						op: "add",
						path: ["map", "c", "a"],
						value: true
					},
					{
						op: "add",
						path: ["map", "d", "a"],
						value: true
					}
				]
			])
		})

		test("#466 - mapChangeBug2 ", () => {
			const obj = {
				map: new Map([
					[
						"a",
						new Map([
							["b", true],
							["c", true],
							["d", true]
						])
					],
					["b", new Map([["a", true]])],
					["c", new Map([["a", true]])],
					["d", new Map([["a", true]])]
				])
			}
			const obj1 = produce(obj, draft => {})
			const [result, p, ip] = produceWithPatches(obj1, draft => {
				const aMap = draft.map.get("a")
				aMap.forEach((_, other) => {
					const otherMap = draft.map.get(other)
					otherMap.delete("a")
				})
			})
			expect(result).toEqual({
				map: new Map([
					[
						"a",
						new Map([
							["b", true],
							["c", true],
							["d", true]
						])
					],
					["b", new Map([])],
					["c", new Map([])],
					["d", new Map([])]
				])
			})
			expect(p).toEqual([
				{
					op: "remove",
					path: ["map", "b", "a"]
				},
				{
					op: "remove",
					path: ["map", "c", "a"]
				},
				{
					op: "remove",
					path: ["map", "d", "a"]
				}
			])
			expect(ip).toEqual([
				{
					op: "add",
					path: ["map", "b", "a"],
					value: true
				},
				{
					op: "add",
					path: ["map", "c", "a"],
					value: true
				},
				{
					op: "add",
					path: ["map", "d", "a"],
					value: true
				}
			])
		})

		test("#586", () => {
			const base = new Set([1, 2])
			const set = produce(base, draftSet => {
				debugger
				expect(Array.from(draftSet)).toEqual([1, 2])
				draftSet.add(3)
			})
			expect(Array.from(set).sort()).toEqual([1, 2, 3])
		})

		test("#627 - new map key with value=undefined", () => {
			const map = new Map()
			const map1 = produce(map, draft => {
				draft.set("key", undefined)
			})
			expect(map1.has("key")).toBe(true)
			expect(map1.get("key")).toBe(undefined)
		})

		test("#663 - clear map", () => {
			const map = new Map([
				["a", "b"],
				["b", "c"]
			])
			const result = produceWithPatches(map, draft => {
				draft.clear()
			})

			expect(result).toEqual([
				new Map(),
				[
					{op: "remove", path: ["a"]},
					{op: "remove", path: ["b"]}
				],
				[
					{op: "add", path: ["a"], value: "b"},
					{op: "add", path: ["b"], value: "c"}
				]
			])
		})

		test("#680 - Clearing empty Set&Map should be noop", () => {
			const map = new Map()
			let result = produce(map, draft => {
				draft.clear()
			})
			expect(result).toBe(map)

			const set = new Set()
			result = produce(set, draft => {
				draft.clear()
			})
			expect(result).toBe(set)
		})

		test("#692 - idempotent plugin loading", () => {
			let mapType1
			produce(new Map(), draft => {
				mapType1 = draft.constructor
			})

			enableMapSet()
			let mapType2
			produce(new Map(), draft => {
				mapType2 = draft.constructor
			})
			expect(mapType1).toBe(mapType2)
		})

		test("#819 - Set with object maintains order when adding object", () => {
			const items = [
				{
					id: "a"
				},
				{
					id: "b"
				}
			]

			const set = new Set([items[0]])
			const newSet = produce(set, draft => {
				draft.add(items[1])
			})

			expect(Array.from(newSet)).toEqual([items[0], items[1]])
		})

		// More specific varaint of above test covering case of adding non-object item
		test("#819 - Set with object maintains order when adding string", () => {
			const items = [
				{
					id: "a"
				},
				"b"
			]

			const set = new Set([items[0]])
			const newSet = produce(set, draft => {
				draft.add(items[1])
			})

			expect(Array.from(newSet)).toEqual([items[0], items[1]])
		})
	})
	describe("set issues " + name, () => {
		test("#819.A - maintains order when adding", () => {
			const objs = [
				"a",
				{
					id: "b"
				}
			]

			const set = new Set([objs[0]])
			const newSet = produce(set, draft => {
				draft.add(objs[1])
			})

			// passes
			expect(Array.from(newSet)).toEqual([objs[0], objs[1]])
		})

		test("#819.B - maintains order when adding", () => {
			const objs = [
				{
					id: "a"
				},
				"b"
			]

			const set = new Set([objs[0]])
			const newSet = produce(set, draft => {
				draft.add(objs[1])
			})

			expect(Array.from(newSet)).toEqual([objs[0], objs[1]])
		})
	})
}
