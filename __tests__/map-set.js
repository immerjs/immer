"use strict"
import {
	Immer,
	nothing,
	original,
	isDraft,
	immerable,
	enableAllPlugins
} from "../src/immer"
import {each, shallowCopy, isEnumerable, DRAFT_STATE} from "../src/common"

enableAllPlugins()

jest.setTimeout(1000)

runBaseTest("proxy (no freeze)", true, false)
// runBaseTest("proxy (autofreeze)", true, true)
// runBaseTest("proxy (autofreeze)(patch listener)", true, true, true)
// runBaseTest("es5 (no freeze)", false, false)
// runBaseTest("es5 (autofreeze)", false, true)
// runBaseTest("es5 (autofreeze)(patch listener)", false, true, true)

function runBaseTest(name, useProxies, autoFreeze, useListener) {
	const listener = useListener ? function() {} : undefined
	const {produce, produceWithPatches} = createPatchedImmer({
		useProxies,
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
	})
}
