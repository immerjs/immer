"use strict"
import {vi} from "vitest"
import {
	produce,
	applyPatches,
	produceWithPatches,
	isDraft,
	immerable,
	nothing,
	enablePatches,
	enableMapSet
} from "../src/immer"

enablePatches()
enableMapSet()

vi.setConfig({
	testTimeout: 1000
})

const isProd = process.env.NODE_ENV === "production"

function createPatchTestData(
	base,
	producer,
	expectedPatches,
	expectedInversePatches,
	expectedResult
) {
	let recordedPatches, recordedInversePatches
	const res = produce(base, producer, (p, i) => {
		recordedPatches = p
		recordedInversePatches = i
	})

	return {
		result: res,
		patches: recordedPatches,
		inversePatches: recordedInversePatches,
		expectedPatches,
		expectedInversePatches,
		expectedResult,
		base
	}
}

function runPatchTests(
	testName,
	base,
	producer,
	expectedPatches,
	expectedInversePatches,
	expectedResult,
	options = {}
) {
	const {only = false, skip = false} = options

	// Choose the appropriate describe function
	let describeFn = describe
	if (testName === "") describeFn = (name, fn) => fn()
	if (only) describeFn = describe.only
	if (skip) describeFn = describe.skip

	let testData = createPatchTestData(
		base,
		producer,
		expectedPatches,
		expectedInversePatches,
		expectedResult
	)

	describeFn(testName, () => {
		if (expectedResult !== undefined) {
			test("produced the correct result", () => {
				expect(testData.result).toEqual(expectedResult)
			})
		}

		test("produces the correct patches", () => {
			expect(testData.patches).toEqual(expectedPatches)
			if (expectedInversePatches) {
				expect(testData.inversePatches).toEqual(expectedInversePatches)
			}
		})

		test("patches are replayable", () => {
			expect(applyPatches(base, testData.patches)).toEqual(testData.result)
		})

		test("patches can be reversed", () => {
			if (expectedInversePatches) {
				expect(applyPatches(testData.result, testData.inversePatches)).toEqual(
					base
				)
			}
		})
	})

	return testData
}

// Convenience functions for common use cases
runPatchTests.only = function(
	testName,
	base,
	producer,
	expectedPatches,
	expectedInversePatches,
	expectedResult
) {
	return runPatchTests(
		testName,
		base,
		producer,
		expectedPatches,
		expectedInversePatches,
		expectedResult,
		{only: true}
	)
}

runPatchTests.skip = function(
	testName,
	base,
	producer,
	expectedPatches,
	expectedInversePatches,
	expectedResult
) {
	return runPatchTests(
		testName,
		base,
		producer,
		expectedPatches,
		expectedInversePatches,
		expectedResult,
		{skip: true}
	)
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

// New macro-style test
runPatchTests(
	"simple assignment - 1",
	{x: 3},
	d => {
		d.x++
	},
	[{op: "replace", path: ["x"], value: 4}]
)

// Original test (commented out for comparison)
// describe("simple assignment - 1", () => {
// 	runPatchTest(
// 		{x: 3},
// 		d => {
// 			d.x++
// 		},
// 		[{op: "replace", path: ["x"], value: 4}]
// 	)
// })

// New macro-style tests
runPatchTests(
	"simple assignment - 2",
	{x: {y: 4}},
	d => {
		d.x.y++
	},
	[{op: "replace", path: ["x", "y"], value: 5}]
)

runPatchTests(
	"simple assignment - 3",
	{x: [{y: 4}]},
	d => {
		d.x[0].y++
	},
	[{op: "replace", path: ["x", 0, "y"], value: 5}]
)

runPatchTests(
	"simple assignment - 4",
	new Map([["x", {y: 4}]]),
	d => {
		d.get("x").y++
	},
	[{op: "replace", path: ["x", "y"], value: 5}],
	[{op: "replace", path: ["x", "y"], value: 4}]
)

runPatchTests(
	"simple assignment - 5",
	{x: new Map([["y", 4]])},
	d => {
		d.x.set("y", 5)
	},
	[{op: "replace", path: ["x", "y"], value: 5}],
	[{op: "replace", path: ["x", "y"], value: 4}]
)

runPatchTests(
	"simple assignment - 6",
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

// Complex test with external variables - keep as individual describe
describe("simple assignment - 7", () => {
	const key1 = {prop: "val1"}
	const key2 = {prop: "val2"}

	runPatchTests(
		"",
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

runPatchTests(
	"simple assignment - 8",
	new Map([[0, new Map([[1, 4]])]]),
	d => {
		d.get(0).set(1, 5)
		d.get(0).set(2, 6)
	},
	[
		{op: "replace", path: [0, 1], value: 5},
		{op: "add", path: [0, 2], value: 6}
	],
	[
		{op: "replace", path: [0, 1], value: 4},
		{op: "remove", path: [0, 2]}
	]
)

runPatchTests(
	"delete 1",
	{x: {y: 4}},
	d => {
		delete d.x
	},
	[{op: "remove", path: ["x"]}]
)

runPatchTests(
	"delete 2",
	new Map([["x", 1]]),
	d => {
		d.delete("x")
	},
	[{op: "remove", path: ["x"]}],
	[{op: "add", path: ["x"], value: 1}]
)

runPatchTests(
	"delete 3",
	{x: new Map([["y", 1]])},
	d => {
		d.x.delete("y")
	},
	[{op: "remove", path: ["x", "y"]}],
	[{op: "add", path: ["x", "y"], value: 1}]
)

describe("delete 5", () => {
	const key1 = {prop: "val1"}
	const key2 = {prop: "val2"}

	runPatchTests(
		"",
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

runPatchTests(
	"delete 6",
	new Set(["x", 1]),
	d => {
		d.delete("x")
	},
	[{op: "remove", path: [0], value: "x"}],
	[{op: "add", path: [0], value: "x"}]
)

runPatchTests(
	"delete 7",
	{x: new Set(["y", 1])},
	d => {
		d.x.delete("y")
	},
	[{op: "remove", path: ["x", 0], value: "y"}],
	[{op: "add", path: ["x", 0], value: "y"}]
)

describe("renaming properties", () => {
	runPatchTests(
		"nested object (no changes)",
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

	runPatchTests(
		"nested change in object",
		{
			a: {b: 1}
		},
		d => {
			d.a.b++
		},
		[{op: "replace", path: ["a", "b"], value: 2}],
		[{op: "replace", path: ["a", "b"], value: 1}]
	)

	runPatchTests(
		"nested change in map",
		new Map([["a", new Map([["b", 1]])]]),
		d => {
			d.get("a").set("b", 2)
		},
		[{op: "replace", path: ["a", "b"], value: 2}],
		[{op: "replace", path: ["a", "b"], value: 1}]
	)

	runPatchTests(
		"nested change in array",
		[[{b: 1}]],
		d => {
			d[0][0].b++
		},
		[{op: "replace", path: [0, 0, "b"], value: 2}],
		[{op: "replace", path: [0, 0, "b"], value: 1}]
	)

	runPatchTests(
		"nested map (no changes)",
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

	runPatchTests(
		"nested object (with changes)",
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

	runPatchTests(
		"nested map (with changes)",
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

	runPatchTests(
		"deeply nested object (with changes)",
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

	runPatchTests(
		"deeply nested map (with changes)",
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

runPatchTests(
	"minimum amount of changes",
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

runPatchTests(
	"arrays - prepend",
	{x: [1, 2, 3]},
	d => {
		d.x.unshift(4)
	},
	[
		{op: "replace", path: ["x", 0], value: 4},
		{op: "replace", path: ["x", 1], value: 1},
		{op: "replace", path: ["x", 2], value: 2},
		{op: "add", path: ["x", 3], value: 3}
	]
)

runPatchTests(
	"arrays - multiple prepend",
	{x: [1, 2, 3]},
	d => {
		d.x.unshift(4)
		d.x.unshift(5)
		// 4,5,1,2,3
	},
	[
		{op: "replace", path: ["x", 0], value: 5},
		{op: "replace", path: ["x", 1], value: 4},
		{op: "replace", path: ["x", 2], value: 1},
		{op: "add", path: ["x", 3], value: 2},
		{op: "add", path: ["x", 4], value: 3}
	]
)

runPatchTests(
	"arrays - splice middle",
	{x: [1, 2, 3]},
	d => {
		d.x.splice(1, 1)
	},
	[
		{op: "replace", path: ["x", 1], value: 3},
		{op: "remove", path: ["x", 2]}
	]
)

runPatchTests(
	"arrays - multiple splice",
	[0, 1, 2, 3, 4, 5, 0],
	d => {
		d.splice(4, 2, 3)
		// [0,1,2,3,3,0]
		d.splice(1, 2, 3)
		// [0,3,3,3,0]
		expect(d.slice()).toEqual([0, 3, 3, 3, 0])
	},
	[
		{op: "replace", path: [1], value: 3},
		{op: "replace", path: [2], value: 3},
		{op: "replace", path: [4], value: 0},
		{op: "remove", path: [6]},
		{op: "remove", path: [5]}
	]
)

runPatchTests(
	"arrays - modify and shrink",
	{x: [1, 2, 3]},
	d => {
		d.x[0] = 4
		d.x.length = 2
		// [0, 2]
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

runPatchTests(
	"arrays - prepend then splice middle",
	{x: [1, 2, 3]},
	d => {
		d.x.unshift(4)
		d.x.splice(2, 1)
		// 4, 1, 3
	},
	[
		{op: "replace", path: ["x", 0], value: 4},
		{op: "replace", path: ["x", 1], value: 1}
	]
)

runPatchTests(
	"arrays - splice middle then prepend",
	{x: [1, 2, 3]},
	d => {
		d.x.splice(1, 1)
		d.x.unshift(4)
		// [4, 1, 3]
	},
	[
		{op: "replace", path: ["x", 0], value: 4},
		{op: "replace", path: ["x", 1], value: 1}
	]
)

runPatchTests(
	"arrays - truncate",
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

runPatchTests(
	"arrays - pop twice",
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

runPatchTests(
	"arrays - push multiple",
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

runPatchTests(
	"arrays - splice (expand)",
	{x: [1, 2, 3]},
	d => {
		d.x.splice(1, 1, 4, 5, 6) // [1,4,5,6,3]
	},
	[
		{op: "replace", path: ["x", 1], value: 4},
		{op: "replace", path: ["x", 2], value: 5},
		{op: "add", path: ["x", 3], value: 6},
		{op: "add", path: ["x", 4], value: 3}
	],
	[
		{op: "replace", path: ["x", 1], value: 2},
		{op: "replace", path: ["x", 2], value: 3},
		{op: "remove", path: ["x", 4]},
		{op: "remove", path: ["x", 3]}
	]
)

runPatchTests(
	"arrays - splice (shrink)",
	{x: [1, 2, 3, 4, 5]},
	d => {
		d.x.splice(1, 3, 6) // [1, 6, 5]
	},
	[
		{op: "replace", path: ["x", 1], value: 6},
		{op: "replace", path: ["x", 2], value: 5},
		{op: "remove", path: ["x", 4]},
		{op: "remove", path: ["x", 3]}
	],
	[
		{op: "replace", path: ["x", 1], value: 2},
		{op: "replace", path: ["x", 2], value: 3},
		{op: "add", path: ["x", 3], value: 4},
		{op: "add", path: ["x", 4], value: 5}
	]
)

runPatchTests(
	"arrays - delete",
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

describe("arrays - append", () => {
	test("appends to array when last part of path is '-'", () => {
		const state = {
			list: [1, 2, 3]
		}
		const patch = {
			op: "add",
			value: 4,
			path: ["list", "-"]
		}
		expect(applyPatches(state, [patch])).toEqual({
			list: [1, 2, 3, 4]
		})
	})
})

runPatchTests(
	"sets - add - 1",
	new Set([1]),
	d => {
		d.add(2)
	},
	[{op: "add", path: [1], value: 2}],
	[{op: "remove", path: [1], value: 2}]
)

runPatchTests(
	"sets - add, delete, add - 1",
	new Set([1]),
	d => {
		d.add(2)
		d.delete(2)
		d.add(2)
	},
	[{op: "add", path: [1], value: 2}],
	[{op: "remove", path: [1], value: 2}]
)

runPatchTests(
	"sets - add, delete, add - 2",
	new Set([2, 1]),
	d => {
		d.add(2)
		d.delete(2)
		d.add(2)
	},
	[],
	[]
)

describe("sets - mutate - 1", () => {
	const findById = (set, id) => {
		for (const item of set) {
			if (item.id === id) return item
		}
	}
	runPatchTests(
		"",
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

// These patches were more optimal pre immer 7, but not always correct
runPatchTests(
	"arrays - splice should should result in remove op.",
	[1, 2],
	d => {
		d.splice(1, 1)
	},
	[{op: "remove", path: [1]}],
	[{op: "add", path: [1], value: 2}]
)

// These patches were more optimal pre immer 7, but not always correct
runPatchTests(
	"arrays - NESTED splice should should result in remove op.",
	{a: {b: {c: [1, 2]}}},
	d => {
		d.a.b.c.splice(1, 1)
	},
	[{op: "remove", path: ["a", "b", "c", 1]}],
	[{op: "add", path: ["a", "b", "c", 1], value: 2}]
)

runPatchTests("simple replacement", {x: 3}, _d => 4, [
	{op: "replace", path: [], value: 4}
])

runPatchTests(
	"same value replacement - 1",
	{x: {y: 3}},
	d => {
		const a = d.x
		d.x = a
	},
	[]
)

runPatchTests(
	"same value replacement - 2",
	{x: {y: 3}},
	d => {
		const a = d.x
		d.x = 4
		d.x = a
	},
	[]
)

runPatchTests(
	"same value replacement - 3",
	{x: 3},
	d => {
		d.x = 3
	},
	[]
)

runPatchTests(
	"same value replacement - 4",
	{x: 3},
	d => {
		d.x = 4
		d.x = 3
	},
	[]
)

runPatchTests(
	"same value replacement - 5",
	new Map([["x", 3]]),
	d => {
		d.set("x", 4)
		d.set("x", 3)
	},
	[],
	[]
)

runPatchTests(
	"same value replacement - 6",
	new Set(["x", 3]),
	d => {
		d.delete("x")
		d.add("x")
	},
	[],
	[]
)

runPatchTests(
	"simple delete",
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

describe("patch compressions yields correct results", () => {
	let p1 = [
		{
			op: "add",
			path: ["x"],
			value: {
				test: true
			}
		}
	]
	let p2 = [
		{
			op: "remove",
			path: ["x"]
		}
	]

	runPatchTests(
		"add only",
		{},
		d => {
			d.x = {test: true}
		},
		p1
	)

	runPatchTests(
		"delete only",
		{x: {test: true}},
		d => {
			delete d.x
		},
		p2
	)
	const testData = runPatchTests(
		"add and delete together cancel",
		{},
		d => {
			applyPatches(d, [...p1, ...p2])
		},
		[]
	)

	expect(testData.result).toEqual({})
})

runPatchTests(
	"change then delete property",
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

describe("#468", () => {
	function run() {
		const item = {id: 1}
		const state = [item]
		const [nextState, patches] = produceWithPatches(state, draft => {
			draft[0].id = 2
			draft[1] = item
		})

		expect(nextState).toEqual([{id: 2}, {id: 1}])
		expect(patches).toEqual([
			{
				op: "replace",
				path: [0, "id"],
				value: 2
			},
			{
				op: "add",
				path: [1],
				value: {
					id: 1
				}
			}
		])

		const final = applyPatches(state, patches)
		expect(final).toEqual(nextState)
	}

	test("proxy", () => {
		run()
	})
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

test("#559 patches works in a nested reducer with proxies", () => {
	const state = {
		x: 1,
		sub: {
			y: [{a: 0}, {a: 1}]
		}
	}

	const changes = []
	const inverseChanges = []

	const newState = produce(state, draft => {
		draft.sub = produce(
			draft.sub,
			draft => {
				draft.y.pop()
			},
			(patches, inversePatches) => {
				expect(isDraft(inversePatches[0].value)).toBeFalsy()
				expect(inversePatches[0].value).toMatchObject({a: 1})
				changes.push(...patches)
				inverseChanges.push(...inversePatches)
			}
		)
	})

	const reversedSubState = applyPatches(newState.sub, inverseChanges)

	expect(reversedSubState).toMatchObject(state.sub)
})

describe("#588", () => {
	const reference = {value: {num: 53}}

	class Base {
		[immerable] = true
		get nested() {
			return reference.value
		}
		set nested(value) {}
	}

	let base = new Base()

	runPatchTests(
		"",
		base,
		vdraft => {
			reference.value = vdraft
			produce(base, bdraft => {
				bdraft.nested.num = 42
			})
		},
		[{op: "add", path: ["num"], value: 42}]
	)
})

test("#676 patching Date objects", () => {
	class Test {
		constructor() {
			this.test = true
		}
		perform() {
			return "tested!"
		}
	}

	const [nextState, patches] = produceWithPatches({}, function(draft) {
		draft.date = new Date("2020-11-10T08:08:08.003Z")
		draft.test = new Test()
	})

	expect(nextState.date.toJSON()).toMatchInlineSnapshot(
		`"2020-11-10T08:08:08.003Z"`
	)
	expect(nextState.test.perform()).toBe("tested!")

	const rebuilt = applyPatches({}, patches)
	expect(rebuilt.date).toBeInstanceOf(Date)
	expect(rebuilt.date.toJSON()).toMatchInlineSnapshot(
		`"2020-11-10T08:08:08.003Z"`
	)
	expect(rebuilt.date).toEqual(new Date("2020-11-10T08:08:08.003Z"))
})

test("do not allow __proto__ polution - 738", () => {
	const obj = {}

	// @ts-ignore
	expect(obj.polluted).toBe(undefined)
	expect(() => {
		applyPatches({}, [
			{op: "add", path: ["__proto__", "polluted"], value: "yes"}
		])
	}).toThrow(
		isProd
			? "19"
			: "Patching reserved attributes like __proto__, prototype and constructor is not allowed"
	)
	// @ts-ignore
	expect(obj.polluted).toBe(undefined)
})

test("do not allow __proto__ polution using arrays - 738", () => {
	const obj = {}
	const ar = []

	// @ts-ignore
	expect(obj.polluted).toBe(undefined)
	// @ts-ignore
	expect(ar.polluted).toBe(undefined)
	expect(() => {
		applyPatches(
			[],
			[{op: "add", path: ["__proto__", "polluted"], value: "yes"}]
		)
	}).toThrow(
		isProd
			? "19"
			: "Patching reserved attributes like __proto__, prototype and constructor is not allowed"
	)
	// @ts-ignore
	expect(obj.polluted).toBe(undefined)
	// @ts-ignore
	expect(ar.polluted).toBe(undefined)
})

test("do not allow prototype polution - 738", () => {
	const obj = {}

	// @ts-ignore
	expect(obj.polluted).toBe(undefined)
	expect(() => {
		applyPatches(Object, [
			{op: "add", path: ["prototype", "polluted"], value: "yes"}
		])
	}).toThrow(
		isProd
			? "19"
			: "Patching reserved attributes like __proto__, prototype and constructor is not allowed"
	)
	// @ts-ignore
	expect(obj.polluted).toBe(undefined)
})

test("do not allow constructor polution - 738", () => {
	const obj = {}

	// @ts-ignore
	expect(obj.polluted).toBe(undefined)
	const t = {}
	applyPatches(t, [{op: "replace", path: ["constructor"], value: "yes"}])
	expect(typeof t.constructor).toBe("function")
	// @ts-ignore
	expect(Object.polluted).toBe(undefined)
})

test("do not allow constructor.prototype polution - 738", () => {
	const obj = {}

	// @ts-ignore
	expect(obj.polluted).toBe(undefined)
	expect(() => {
		applyPatches({}, [
			{op: "add", path: ["constructor", "prototype", "polluted"], value: "yes"}
		])
	}).toThrow(
		isProd
			? "19"
			: "Patching reserved attributes like __proto__, prototype and constructor is not allowed"
	)
	// @ts-ignore
	expect(Object.polluted).toBe(undefined)
})

test("maps can store __proto__, prototype and constructor props", () => {
	const obj = {}
	const map = new Map()
	map.set("__proto__", {})
	map.set("constructor", {})
	map.set("prototype", {})
	const newMap = applyPatches(map, [
		{op: "add", path: ["__proto__", "polluted"], value: "yes"},
		{op: "add", path: ["constructor", "polluted"], value: "yes"},
		{op: "add", path: ["prototype", "polluted"], value: "yes"}
	])
	expect(newMap.get("__proto__").polluted).toBe("yes")
	expect(newMap.get("constructor").polluted).toBe("yes")
	expect(newMap.get("prototype").polluted).toBe("yes")
	expect(obj.polluted).toBe(undefined)
})

test("CVE-2020-28477 (https://snyk.io/vuln/SNYK-JS-IMMER-1019369) follow up", () => {
	const obj = {}

	// @ts-ignore
	expect(obj.polluted).toBe(undefined)
	expect(() => {
		applyPatches({}, [
			{op: "add", path: [["__proto__"], "polluted"], value: "yes"}
		])
	}).toThrow(
		isProd
			? "19"
			: "Patching reserved attributes like __proto__, prototype and constructor is not allowed"
	)
	// @ts-ignore
	expect(obj.polluted).toBe(undefined)
})

test("#648 assigning object to itself should not change patches", () => {
	const input = {
		obj: {
			value: 200
		}
	}

	const [nextState, patches] = produceWithPatches(input, draft => {
		draft.obj.value = 1
		draft.obj = draft.obj
	})

	expect(patches).toEqual([
		{
			op: "replace",
			path: ["obj", "value"],
			value: 1
		}
	])
})

test("#791 patch for  nothing is stored as undefined", () => {
	const [newState, patches] = produceWithPatches({abc: 123}, draft => nothing)
	expect(patches).toEqual([{op: "replace", path: [], value: undefined}])

	expect(applyPatches({}, patches)).toEqual(undefined)
})

test("#876 Ensure empty patch set for atomic set+delete on Map", () => {
	{
		const [newState, patches] = produceWithPatches(
			new Map([["foo", "baz"]]),
			draft => {
				draft.set("foo", "bar")
				draft.delete("foo")
			}
		)
		expect(patches).toEqual([{op: "remove", path: ["foo"]}])
	}

	{
		const [newState, patches] = produceWithPatches(new Map(), draft => {
			draft.set("foo", "bar")
			draft.delete("foo")
		})
		expect(patches).toEqual([])
	}
})

test("#888 patch to a primitive produces the primitive", () => {
	{
		const [res, patches] = produceWithPatches({abc: 123}, draft => nothing)
		expect(res).toEqual(undefined)
		expect(patches).toEqual([{op: "replace", path: [], value: undefined}])
	}
	{
		const [res, patches] = produceWithPatches(null, draft => nothing)
		expect(res).toEqual(undefined)
		expect(patches).toEqual([{op: "replace", path: [], value: undefined}])
	}
	{
		const [res, patches] = produceWithPatches(0, draft => nothing)
		expect(res).toEqual(undefined)
		expect(patches).toEqual([{op: "replace", path: [], value: undefined}])
	}
	{
		const [res, patches] = produceWithPatches("foobar", draft => nothing)
		expect(res).toEqual(undefined)
		expect(patches).toEqual([{op: "replace", path: [], value: undefined}])
	}
	{
		const [res, patches] = produceWithPatches([], draft => nothing)
		expect(res).toEqual(undefined)
		expect(patches).toEqual([{op: "replace", path: [], value: undefined}])
	}
	{
		const [res, patches] = produceWithPatches(false, draft => nothing)
		expect(res).toEqual(undefined)
		expect(patches).toEqual([{op: "replace", path: [], value: undefined}])
	}
	{
		const [res, patches] = produceWithPatches(
			"foobar",
			draft => "something else"
		)
		expect(res).toEqual("something else")
		expect(patches).toEqual([
			{op: "replace", path: [], value: "something else"}
		])
	}
	{
		const [res, patches] = produceWithPatches(false, draft => true)
		expect(res).toEqual(true)
		expect(patches).toEqual([{op: "replace", path: [], value: true}])
	}
})

runPatchTests(
	"#879 delete item from array",
	[1, 2, 3],
	draft => {
		delete draft[1]
	},
	[{op: "replace", path: [1], value: undefined}],
	[{op: "replace", path: [1], value: 2}],
	[1, undefined, 3]
)

runPatchTests(
	"#879 delete item from array - 2",
	[1, 2, 3],
	draft => {
		delete draft[2]
	},
	[{op: "replace", path: [2], value: undefined}],
	[{op: "replace", path: [2], value: 3}],
	[1, 2, undefined]
)

test("#897 appendPatch", () => {
	const state0 = {a: []}
	const state1 = applyPatches(state0, [{op: "add", path: ["a", "-"], value: 1}])
	const state2 = applyPatches(state1, [{op: "add", path: ["a", "-"], value: 2}])
	const state3 = applyPatches(state2, [{op: "add", path: ["a", "-"], value: 3}])
	expect(state3).toEqual({
		a: [1, 2, 3]
	})
})
