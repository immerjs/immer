import {produce, produceWithPatches, setUseProxies} from "../src"

test("empty stub test", () => {
	expect(true).toBe(true)
})

describe("map set", () => {
	test("can assign set value", () => {
		setUseProxies(false)

		const baseState = new Map([["x", 1]])
		const nextState = produce(baseState, s => {
			s.set("x", 2)
		})
		expect(nextState).not.toBe(baseState)
		expect(nextState.get("x")).toEqual(2)
	})

	test("can assign by key", () => {
		setUseProxies(false)

		const baseState = new Map([["x", {a: 1}]])
		const nextState = produce(baseState, s => {
			s.get("x")!.a++
		})
		expect(nextState).not.toBe(baseState)
		expect(nextState.get("x")!.a).toEqual(2)
	})
})
