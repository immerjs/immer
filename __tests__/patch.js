"use strict"
import produce, {
	setUseProxies,
	applyPatches,
	produceWithPatches,
	enableAllPlugins
} from "../src/immer"

enableAllPlugins()

jest.setTimeout(1000)

function runPatchTest(base, producer, patches, inversePathes) {
	let resultProxies, resultEs5

	function runPatchTestHelper() {
		let recordedPatches
		let recordedInversePatches
		const res = produce(base, producer, (p, i) => {
			recordedPatches = p
			recordedInversePatches = i
		})

		test("produces the correct patches", () => {
			expect(recordedPatches).toEqual(patches)
			if (inversePathes) expect(recordedInversePatches).toEqual(inversePathes)
		})

		test("patches are replayable", () => {
			expect(applyPatches(base, recordedPatches)).toEqual(res)
		})

		test("patches can be reversed", () => {
			expect(applyPatches(res, recordedInversePatches)).toEqual(base)
		})

		return res
	}

	describe(`proxy`, () => {
		setUseProxies(true)
		resultProxies = runPatchTestHelper()
	})

	describe(`es5`, () => {
		setUseProxies(false)
		resultEs5 = runPatchTestHelper()
		test("ES5 and Proxy implementation yield same result", () => {
			expect(resultEs5).toEqual(resultProxies)
		})
	})

	return resultProxies
}

describe("applyPatches", () => {
	it("mutates the base state when it is a draft", () => {
		produce({a: 1}, draft => {
			const result = applyPatches(draft, [
				{op: "replace", path: ["a"], value: 2}
			])
			expect(result).toBe(draft)
			expect(draft.a).toBe(2)
		})
	})
	it("produces a copy of the base state when not a draft", () => {
		const base = {a: 1}
		const result = applyPatches(base, [{op: "replace", path: ["a"], value: 2}])
		expect(result).not.toBe(base)
		expect(result.a).toBe(2)
		expect(base.a).toBe(1)
	})
	it('throws when `op` is not "add", "replace", nor "remove"', () => {
		expect(() => {
			const patch = {op: "copy", from: [0], path: [1]}
			applyPatches([2], [patch])
		}).toThrowErrorMatchingSnapshot()
	})
	it("throws when `path` cannot be resolved", () => {
		// missing parent
		expect(() => {
			const patch = {op: "add", path: ["a", "b"], value: 1}
			applyPatches({}, [patch])
		}).toThrowErrorMatchingSnapshot()

		// missing grand-parent
		expect(() => {
			const patch = {op: "add", path: ["a", "b", "c"], value: 1}
			applyPatches({}, [patch])
		}).toThrowErrorMatchingSnapshot()
	})
	it("applied patches cannot be modified", () => {
		// see also: https://github.com/immerjs/immer/issues/411
		const s0 = {
			items: [1]
		}

		const [s1, p1] = produceWithPatches(s0, draft => {
			draft.items = []
		})

		const replaceValueBefore = p1[0].value.slice()

		const [s2, p2] = produceWithPatches(s1, draft => {
			draft.items.push(2)
		})

		applyPatches(s0, [...p1, ...p2])

		const replaceValueAfter = p1[0].value.slice()

		expect(replaceValueAfter).toStrictEqual(replaceValueBefore)
	})
})

describe("simple assignment - 1", () => {
	runPatchTest(
		{x: 3},
		d => {
			d.x++
		},
		[{op: "replace", path: ["x"], value: 4}]
	)
})

describe("simple assignment - 2", () => {
	runPatchTest(
		{x: {y: 4}},
		d => {
			d.x.y++
		},
		[{op: "replace", path: ["x", "y"], value: 5}]
	)
})

describe("simple assignment - 3", () => {
	runPatchTest(
		{x: [{y: 4}]},
		d => {
			d.x[0].y++
		},
		[{op: "replace", path: ["x", 0, "y"], value: 5}]
	)
})

describe("simple assignment - 4", () => {
	runPatchTest(
		new Map([["x", {y: 4}]]),
		d => {
			d.get("x").y++
		},
		[{op: "replace", path: ["x", "y"], value: 5}],
		[{op: "replace", path: ["x", "y"], value: 4}]
	)
})

describe("simple assignment - 5", () => {
	runPatchTest(
		{x: new Map([["y", 4]])},
		d => {
			d.x.set("y", 5)
		},
		[{op: "replace", path: ["x", "y"], value: 5}],
		[{op: "replace", path: ["x", "y"], value: 4}]
	)
})

describe("simple assignment - 6", () => {
	runPatchTest(
		new Map([["x", 1]]),
		d => {
			// Map.prototype.set should return the Map itself
			const res = d.set("x", 2)
			res.set("y", 3)
		},
		[
			{op: "replace", path: ["x"], value: 2},
			{op: "add", path: ["y"], value: 3}
		],
		[
			{op: "replace", path: ["x"], value: 1},
			{op: "remove", path: ["y"]}
		]
	)
})

describe("simple assignment - 7", () => {
	const key1 = {prop: "val1"}
	const key2 = {prop: "val2"}
	runPatchTest(
		{x: new Map([[key1, 4]])},
		d => {
			d.x.set(key1, 5)
			d.x.set(key2, 6)
		},
		[
			{op: "replace", path: ["x", key1], value: 5},
			{op: "add", path: ["x", key2], value: 6}
		],
		[
			{op: "replace", path: ["x", key1], value: 4},
			{op: "remove", path: ["x", key2]}
		]
	)
})

describe("delete 1", () => {
	runPatchTest(
		{x: {y: 4}},
		d => {
			delete d.x
		},
		[{op: "remove", path: ["x"]}]
	)
})

describe("delete 2", () => {
	runPatchTest(
		new Map([["x", 1]]),
		d => {
			d.delete("x")
		},
		[{op: "remove", path: ["x"]}],
		[{op: "add", path: ["x"], value: 1}]
	)
})

describe("delete 3", () => {
	runPatchTest(
		{x: new Map([["y", 1]])},
		d => {
			d.x.delete("y")
		},
		[{op: "remove", path: ["x", "y"]}],
		[{op: "add", path: ["x", "y"], value: 1}]
	)
})

describe("delete 5", () => {
	const key1 = {prop: "val1"}
	const key2 = {prop: "val2"}
	runPatchTest(
		{
			x: new Map([
				[key1, 1],
				[key2, 2]
			])
		},
		d => {
			d.x.delete(key1)
			d.x.delete(key2)
		},
		[
			{op: "remove", path: ["x", key1]},
			{op: "remove", path: ["x", key2]}
		],
		[
			{op: "add", path: ["x", key1], value: 1},
			{op: "add", path: ["x", key2], value: 2}
		]
	)
})

describe("delete 6", () => {
	runPatchTest(
		new Set(["x", 1]),
		d => {
			d.delete("x")
		},
		[{op: "remove", path: [0], value: "x"}],
		[{op: "add", path: [0], value: "x"}]
	)
})

describe("delete 7", () => {
	runPatchTest(
		{x: new Set(["y", 1])},
		d => {
			d.x.delete("y")
		},
		[{op: "remove", path: ["x", 0], value: "y"}],
		[{op: "add", path: ["x", 0], value: "y"}]
	)
})

describe("renaming properties", () => {
	describe("nested object (no changes)", () => {
		runPatchTest(
			{a: {b: 1}},
			d => {
				d.x = d.a
				delete d.a
			},
			[
				{op: "add", path: ["x"], value: {b: 1}},
				{op: "remove", path: ["a"]}
			]
		)
	})

	describe("nested map (no changes)", () => {
		runPatchTest(
			new Map([["a", new Map([["b", 1]])]]),
			d => {
				d.set("x", d.get("a"))
				d.delete("a")
			},
			[
				{op: "add", path: ["x"], value: new Map([["b", 1]])},
				{op: "remove", path: ["a"]}
			],
			[
				{op: "remove", path: ["x"]},
				{op: "add", path: ["a"], value: new Map([["b", 1]])}
			]
		)
	})

	describe("nested object (with changes)", () => {
		runPatchTest(
			{a: {b: 1, c: 1}},
			d => {
				let a = d.a
				a.b = 2 // change
				delete a.c // delete
				a.y = 2 // add

				// rename
				d.x = a
				delete d.a
			},
			[
				{op: "add", path: ["x"], value: {b: 2, y: 2}},
				{op: "remove", path: ["a"]}
			]
		)
	})

	describe("nested map (with changes)", () => {
		runPatchTest(
			new Map([
				[
					"a",
					new Map([
						["b", 1],
						["c", 1]
					])
				]
			]),
			d => {
				let a = d.get("a")
				a.set("b", 2) // change
				a.delete("c") // delete
				a.set("y", 2) // add

				// rename
				d.set("x", a)
				d.delete("a")
			},
			[
				{
					op: "add",
					path: ["x"],
					value: new Map([
						["b", 2],
						["y", 2]
					])
				},
				{op: "remove", path: ["a"]}
			],
			[
				{op: "remove", path: ["x"]},
				{
					op: "add",
					path: ["a"],
					value: new Map([
						["b", 1],
						["c", 1]
					])
				}
			]
		)
	})

	describe("deeply nested object (with changes)", () => {
		runPatchTest(
			{a: {b: {c: 1, d: 1}}},
			d => {
				let b = d.a.b
				b.c = 2 // change
				delete b.d // delete
				b.y = 2 // add

				// rename
				d.a.x = b
				delete d.a.b
			},
			[
				{op: "add", path: ["a", "x"], value: {c: 2, y: 2}},
				{op: "remove", path: ["a", "b"]}
			]
		)
	})

	describe("deeply nested map (with changes)", () => {
		runPatchTest(
			new Map([
				[
					"a",
					new Map([
						[
							"b",
							new Map([
								["c", 1],
								["d", 1]
							])
						]
					])
				]
			]),
			d => {
				let b = d.get("a").get("b")
				b.set("c", 2) // change
				b.delete("d") // delete
				b.set("y", 2) // add

				// rename
				d.get("a").set("x", b)
				d.get("a").delete("b")
			},
			[
				{
					op: "add",
					path: ["a", "x"],
					value: new Map([
						["c", 2],
						["y", 2]
					])
				},
				{op: "remove", path: ["a", "b"]}
			],
			[
				{op: "remove", path: ["a", "x"]},
				{
					op: "add",
					path: ["a", "b"],
					value: new Map([
						["c", 1],
						["d", 1]
					])
				}
			]
		)
	})
})

describe("minimum amount of changes", () => {
	runPatchTest(
		{x: 3, y: {a: 4}, z: 3},
		d => {
			d.y.a = 4
			d.y.b = 5
			Object.assign(d, {x: 4, y: {a: 2}})
		},
		[
			{op: "replace", path: ["x"], value: 4},
			{op: "replace", path: ["y"], value: {a: 2}}
		]
	)
})

describe("arrays - prepend", () => {
	runPatchTest(
		{x: [1, 2, 3]},
		d => {
			d.x.unshift(4)
		},
		[{op: "add", path: ["x", 0], value: 4}]
	)
})

describe("arrays - multiple prepend", () => {
	runPatchTest(
		{x: [1, 2, 3]},
		d => {
			d.x.unshift(4)
			d.x.unshift(5)
		},
		[
			{op: "add", path: ["x", 0], value: 5},
			{op: "add", path: ["x", 1], value: 4}
		]
	)
})

describe("arrays - splice middle", () => {
	runPatchTest(
		{x: [1, 2, 3]},
		d => {
			d.x.splice(1, 1)
		},
		[{op: "remove", path: ["x", 1]}]
	)
})

describe("arrays - multiple splice", () => {
	runPatchTest(
		[0, 1, 2, 3, 4, 5, 0],
		d => {
			d.splice(4, 2, 3)
			d.splice(1, 2, 3)
		},
		[
			{op: "replace", path: [1], value: 3},
			{op: "replace", path: [2], value: 3},
			{op: "remove", path: [5]},
			{op: "remove", path: [4]}
		]
	)
})

describe("arrays - modify and shrink", () => {
	runPatchTest(
		{x: [1, 2, 3]},
		d => {
			d.x[0] = 4
			d.x.length = 2
		},
		[
			{op: "replace", path: ["x", 0], value: 4},
			{op: "remove", path: ["x", 2]}
		],
		[
			{op: "replace", path: ["x", 0], value: 1},
			{op: "add", path: ["x", 2], value: 3}
		]
	)
})

describe("arrays - prepend then splice middle", () => {
	runPatchTest(
		{x: [1, 2, 3]},
		d => {
			d.x.unshift(4)
			d.x.splice(2, 1)
		},
		[
			{op: "replace", path: ["x", 0], value: 4},
			{op: "replace", path: ["x", 1], value: 1}
		]
	)
})

describe("arrays - splice middle then prepend", () => {
	runPatchTest(
		{x: [1, 2, 3]},
		d => {
			d.x.splice(1, 1)
			d.x.unshift(4)
		},
		[
			{op: "replace", path: ["x", 0], value: 4},
			{op: "replace", path: ["x", 1], value: 1}
		]
	)
})

describe("arrays - truncate", () => {
	runPatchTest(
		{x: [1, 2, 3]},
		d => {
			d.x.length -= 2
		},
		[
			{op: "remove", path: ["x", 2]},
			{op: "remove", path: ["x", 1]}
		],
		[
			{op: "add", path: ["x", 1], value: 2},
			{op: "add", path: ["x", 2], value: 3}
		]
	)
})

describe("arrays - pop twice", () => {
	runPatchTest(
		{x: [1, 2, 3]},
		d => {
			d.x.pop()
			d.x.pop()
		},
		[
			{op: "remove", path: ["x", 2]},
			{op: "remove", path: ["x", 1]}
		]
	)
})

describe("arrays - push multiple", () => {
	runPatchTest(
		{x: [1, 2, 3]},
		d => {
			d.x.push(4, 5)
		},
		[
			{op: "add", path: ["x", 3], value: 4},
			{op: "add", path: ["x", 4], value: 5}
		],
		[
			{op: "remove", path: ["x", 4]},
			{op: "remove", path: ["x", 3]}
		]
	)
})

describe("arrays - splice (expand)", () => {
	runPatchTest(
		{x: [1, 2, 3]},
		d => {
			d.x.splice(1, 1, 4, 5, 6)
		},
		[
			{op: "replace", path: ["x", 1], value: 4},
			{op: "add", path: ["x", 2], value: 5},
			{op: "add", path: ["x", 3], value: 6}
		],
		[
			{op: "replace", path: ["x", 1], value: 2},
			{op: "remove", path: ["x", 3]},
			{op: "remove", path: ["x", 2]}
		]
	)
})

describe("arrays - splice (shrink)", () => {
	runPatchTest(
		{x: [1, 2, 3, 4, 5]},
		d => {
			d.x.splice(1, 3, 6)
		},
		[
			{op: "replace", path: ["x", 1], value: 6},
			{op: "remove", path: ["x", 3]},
			{op: "remove", path: ["x", 2]}
		],
		[
			{op: "replace", path: ["x", 1], value: 2},
			{op: "add", path: ["x", 2], value: 3},
			{op: "add", path: ["x", 3], value: 4}
		]
	)
})

describe("arrays - delete", () => {
	runPatchTest(
		{
			x: [
				{a: 1, b: 2},
				{c: 3, d: 4}
			]
		},
		d => {
			delete d.x[1].c
		},
		[{op: "remove", path: ["x", 1, "c"]}]
	)
})

describe("sets - add - 1", () => {
	runPatchTest(
		new Set([1]),
		d => {
			d.add(2)
		},
		[{op: "add", path: [1], value: 2}],
		[{op: "remove", path: [1], value: 2}]
	)
})

describe("sets - add, delete, add - 1", () => {
	runPatchTest(
		new Set([1]),
		d => {
			d.add(2)
			d.delete(2)
			d.add(2)
		},
		[{op: "add", path: [1], value: 2}],
		[{op: "remove", path: [1], value: 2}]
	)
})

describe("sets - add, delete, add - 2", () => {
	runPatchTest(
		new Set([2, 1]),
		d => {
			d.add(2)
			d.delete(2)
			d.add(2)
		},
		[],
		[]
	)
})

describe("sets - mutate - 1", () => {
	const findById = (set, id) => {
		for (const item of set) {
			if (item.id === id) return item
		}
	}
	runPatchTest(
		new Set([
			{id: 1, val: "We"},
			{id: 2, val: "will"}
		]),
		d => {
			const obj1 = findById(d, 1)
			const obj2 = findById(d, 2)
			obj1.val = "rock"
			obj2.val = "you"
		},
		[
			{op: "remove", path: [0], value: {id: 1, val: "We"}},
			{op: "remove", path: [1], value: {id: 2, val: "will"}},
			{op: "add", path: [0], value: {id: 1, val: "rock"}},
			{op: "add", path: [1], value: {id: 2, val: "you"}}
		],
		[
			{op: "remove", path: [1], value: {id: 2, val: "you"}},
			{op: "remove", path: [0], value: {id: 1, val: "rock"}},
			{op: "add", path: [1], value: {id: 2, val: "will"}},
			{op: "add", path: [0], value: {id: 1, val: "We"}}
		]
	)
})

describe("arrays - splice should should result in remove op.", () => {
	runPatchTest(
		[1, 2],
		d => {
			d.splice(1, 1)
		},
		[{op: "remove", path: [1]}],
		[{op: "add", path: [1], value: 2}]
	)
})

describe("arrays - NESTED splice should should result in remove op.", () => {
	runPatchTest(
		{a: {b: {c: [1, 2]}}},
		d => {
			d.a.b.c.splice(1, 1)
		},
		[{op: "remove", path: ["a", "b", "c", 1]}],
		[{op: "add", path: ["a", "b", "c", 1], value: 2}]
	)
})

describe("simple replacement", () => {
	runPatchTest({x: 3}, _d => 4, [{op: "replace", path: [], value: 4}])
})

describe("same value replacement - 1", () => {
	runPatchTest(
		{x: {y: 3}},
		d => {
			const a = d.x
			d.x = a
		},
		[]
	)
})

describe("same value replacement - 2", () => {
	runPatchTest(
		{x: {y: 3}},
		d => {
			const a = d.x
			d.x = 4
			d.x = a
		},
		[]
	)
})

describe("same value replacement - 3", () => {
	runPatchTest(
		{x: 3},
		d => {
			d.x = 3
		},
		[]
	)
})

describe("same value replacement - 4", () => {
	runPatchTest(
		{x: 3},
		d => {
			d.x = 4
			d.x = 3
		},
		[]
	)
})

describe("same value replacement - 5", () => {
	runPatchTest(
		new Map([["x", 3]]),
		d => {
			d.set("x", 4)
			d.set("x", 3)
		},
		[],
		[]
	)
})

describe("same value replacement - 6", () => {
	runPatchTest(
		new Set(["x", 3]),
		d => {
			d.delete("x")
			d.add("x")
		},
		[],
		[]
	)
})

describe("simple delete", () => {
	runPatchTest(
		{x: 2},
		d => {
			delete d.x
		},
		[
			{
				op: "remove",
				path: ["x"]
			}
		]
	)
})

describe("patch compressions yields correct results", () => {
	let p1, p2
	runPatchTest(
		{},
		d => {
			d.x = {test: true}
		},
		(p1 = [
			{
				op: "add",
				path: ["x"],
				value: {
					test: true
				}
			}
		])
	)
	runPatchTest(
		{x: {test: true}},
		d => {
			delete d.x
		},
		(p2 = [
			{
				op: "remove",
				path: ["x"]
			}
		])
	)
	const res = runPatchTest(
		{},
		d => {
			applyPatches(d, [...p1, ...p2])
		},
		[]
	)

	expect(res).toEqual({})
})

describe("change then delete property", () => {
	const res = runPatchTest(
		{
			x: 1
		},
		d => {
			d.x = 2
			delete d.x
		},
		[
			{
				op: "remove",
				path: ["x"]
			}
		]
	)
	test("valid result", () => {
		expect(res).toEqual({})
	})
})

test("replaying patches with interweaved replacements should work correctly", () => {
	const patches = []
	const s0 = {x: 1}

	const s1 = produce(
		s0,
		draft => {
			draft.x = 2
		},
		p => {
			patches.push(...p)
		}
	)

	const s2 = produce(
		s1,
		draft => {
			return {x: 0}
		},
		p => {
			patches.push(...p)
		}
	)

	const s3 = produce(
		s2,
		draft => {
			draft.x--
		},
		p => {
			patches.push(...p)
		}
	)

	expect(s3).toEqual({x: -1}) // correct result
	expect(applyPatches(s0, patches)).toEqual({x: -1}) // correct replay

	// manual replay on a draft should also be correct
	expect(
		produce(s0, draft => {
			return applyPatches(draft, patches)
		})
	).toEqual({x: -1})
})

test.skip("#468", () => {
	const item = {id: 1}

	const state = [item]

	const [nextState, patches] = produceWithPatches(state, draft => {
		draft[0].id = 2
		draft[1] = item
	})

	expect(nextState).toMatchInlineSnapshot(`
		Array [
		  Object {
		    "id": 2,
		  },
		  Object {
		    "id": 1,
		  },
		]
	`)
	expect(patches).toMatchInlineSnapshot(`
				Array [
				  Object {
				    "op": "replace",
				    "path": Array [
				      0,
				      "id",
				    ],
				    "value": 2,
				  },
				  Object {
				    "op": "add",
				    "path": Array [
				      0,
				    ],
				    "value": Object {
				      "id": 2,
				    },
				  },
				]
		`)

	const final = applyPatches(state, patches)
	expect(final).toEqual(nextState)
})

test("#521", () => {
	const state = new Map()

	const [nextState, patches] = produceWithPatches(state, draft => {
		draft.set("hello", new Set(["world"]))
	})

	let patchedState = applyPatches(state, patches)
	expect(patchedState).toEqual(nextState)

	const [nextStateV2, patchesV2] = produceWithPatches(nextState, draft => {
		draft.get("hello").add("immer")
	})

	expect(applyPatches(nextState, patchesV2)).toEqual(
		new Map([["hello", new Set(["world", "immer"])]])
	)
})
