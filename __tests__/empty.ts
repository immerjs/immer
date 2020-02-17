import {
	produce,
	produceWithPatches,
	setUseProxies,
	enableAllPlugins
} from "../src/immer"
import {DRAFT_STATE} from "../src/internal"

enableAllPlugins()

test("empty stub test", () => {
	expect(true).toBe(true)
})

describe("map set - es5", () => {
	test("can assign set value", () => {
		setUseProxies(false)

		const baseState = new Map([["x", 1]])
		debugger
		const nextState = produce(baseState, s => {
			s.set("x", 2)
		})
		expect(baseState.get("x")).toEqual(1)
		expect(nextState).not.toBe(baseState)
		expect(nextState.get("x")).toEqual(2)
	})

	test("can assign by key", () => {
		setUseProxies(false)

		const baseState = new Map([["x", {a: 1}]])
		const nextState = produce(baseState, s => {
			s.get("x")!.a++
		})
		expect(nextState.get("x")!.a).toEqual(2)
		expect(baseState.get("x")!.a).toEqual(1)
		expect(nextState).not.toBe(baseState)
	})
})

describe("map set - proxy", () => {
	test("can assign set value", () => {
		setUseProxies(true)

		const baseState = new Map([["x", 1]])
		const nextState = produce(baseState, s => {
			s.set("x", 2)
		})
		expect(baseState.get("x")).toEqual(1)
		expect(nextState).not.toBe(baseState)
		expect(nextState.get("x")).toEqual(2)
	})

	test("can assign by key", () => {
		setUseProxies(true)

		const baseState = new Map([["x", {a: 1}]])
		const nextState = produce(baseState, s => {
			s.get("x")!.a++
		})
		expect(nextState.get("x")!.a).toEqual(2)
		expect(baseState.get("x")!.a).toEqual(1)
		expect(nextState).not.toBe(baseState)
	})

	test("deep change bubbles up", () => {
		setUseProxies(true)

		const baseState = createBaseState()
		const nextState = produce(baseState, s => {
			s.anObject.nested.yummie = false
		})
		expect(nextState).not.toBe(baseState)
		expect(nextState.anObject).not.toBe(baseState.anObject)
		expect(baseState.anObject.nested.yummie).toBe(true)
		expect(nextState.anObject.nested.yummie).toBe(false)
		expect(nextState.anArray).toBe(baseState.anArray)
	})

	it("can assign by key", () => {
		setUseProxies(true)
		const baseState = createBaseState()

		const nextState = produce(baseState, s => {
			// Map.prototype.set should return the Map itself
			const res = s.aMap.set("force", true)
			// @ts-ignore
			if (!global.USES_BUILD)
				expect(res).toBe((s.aMap as any)[DRAFT_STATE].draft_)
		})
		expect(nextState).not.toBe(baseState)
		expect(nextState.aMap).not.toBe(baseState.aMap)
		expect(nextState.aMap.get("force")).toEqual(true)
	})

	it("can use 'delete' to remove items", () => {
		const baseState = createBaseState()

		const nextState = produce(baseState, s => {
			expect(s.aMap.has("jedi")).toBe(true)
			expect(s.aMap.delete("jedi")).toBe(true)
			expect(s.aMap.has("jedi")).toBe(false)
		})
		expect(nextState.aMap).not.toBe(baseState.aMap)
		expect(nextState.aMap.size).toBe(baseState.aMap.size - 1)
		expect(baseState.aMap.has("jedi")).toBe(true)
		expect(nextState.aMap.has("jedi")).toBe(false)
	})

	it("support 'has'", () => {
		const baseState = createBaseState()

		const nextState = produce(baseState, s => {
			expect(s.aMap.has("newKey")).toBe(false)
			s.aMap.set("newKey", true)
			expect(s.aMap.has("newKey")).toBe(true)
		})
		expect(nextState).not.toBe(baseState)
		expect(nextState.aMap).not.toBe(baseState.aMap)
		expect(baseState.aMap.has("newKey")).toBe(false)
		expect(nextState.aMap.has("newKey")).toBe(true)
	})
})

function createBaseState() {
	const data = {
		anInstance: new (class {})(),
		anArray: [3, 2, {c: 3}, 1],
		aMap: new Map([
			["jedi", {name: "Luke", skill: 10}],
			["jediTotal", 42],
			["force", "these aren't the droids you're looking for"]
		] as any),
		aSet: new Set([
			"Luke",
			42,
			{
				jedi: "Yoda"
			}
		]),
		aProp: "hi",
		anObject: {
			nested: {
				yummie: true
			},
			coffee: false
		}
	}
	return data
}
