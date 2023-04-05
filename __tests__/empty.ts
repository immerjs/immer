import {
	produce,
	produceWithPatches,
	immerable,
	enableMapSet,
	enablePatches,
	applyPatches
} from "../src/immer"
import {DRAFT_STATE, Patch} from "../src/internal"

enableMapSet()
enablePatches()

test("empty stub test", () => {
	expect(true).toBe(true)
})

describe("map set - proxy", () => {
	test("can assign set value", () => {
		const baseState = new Map([["x", 1]])
		const nextState = produce(baseState, s => {
			s.set("x", 2)
		})
		expect(baseState.get("x")).toEqual(1)
		expect(nextState).not.toBe(baseState)
		expect(nextState.get("x")).toEqual(2)
	})

	test("can assign by key", () => {
		const baseState = new Map([["x", {a: 1}]])
		const nextState = produce(baseState, s => {
			s.get("x")!.a++
		})
		expect(nextState.get("x")!.a).toEqual(2)
		expect(baseState.get("x")!.a).toEqual(1)
		expect(nextState).not.toBe(baseState)
	})

	test("deep change bubbles up", () => {
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

describe("#768", () => {
	class Stock {
		[immerable] = true

		constructor(public price: number) {}

		pushPrice(price: number) {
			this.price = price
		}
	}

	type State = {
		stock: Stock
	}

	test("bla", () => {
		// Set up conditions to produce the error
		const errorProducingPatch = [
			{
				op: "replace",
				path: ["stock"],
				value: new Stock(200)
			}
		] as Patch[]

		// Start with modified state
		const state = {
			stock: new Stock(100)
		}

		expect(state.stock.price).toEqual(100)
		expect(state.stock[immerable]).toBeTruthy()
		// Use patch to "replace" stocks
		const resetState: State = applyPatches(state, errorProducingPatch)
		expect(state.stock.price).toEqual(100)
		expect(resetState.stock.price).toEqual(200)
		expect(resetState.stock[immerable]).toBeTruthy()

		// Problems come in when resetState is modified
		const updatedState = produce(resetState, draft => {
			draft.stock.pushPrice(300)
		})
		expect(state.stock.price).toEqual(100)
		expect(updatedState.stock.price).toEqual(300)
		expect(updatedState.stock[immerable]).toBeTruthy()
		expect(resetState.stock.price).toEqual(200)
	})
})
