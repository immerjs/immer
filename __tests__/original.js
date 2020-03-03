"use strict"
import produce, {original, setUseProxies, enableAllPlugins} from "../src/immer"

enableAllPlugins()

describe("original", () => {
	const baseState = {
		a: [],
		b: {}
	}

	it("should return the original from the draft", () => {
		setUseProxies(true)

		produce(baseState, draftState => {
			expect(original(draftState)).toBe(baseState)
			expect(original(draftState.a)).toBe(baseState.a)
			expect(original(draftState.b)).toBe(baseState.b)
		})

		setUseProxies(false)

		produce(baseState, draftState => {
			expect(original(draftState)).toBe(baseState)
			expect(original(draftState.a)).toBe(baseState.a)
			expect(original(draftState.b)).toBe(baseState.b)
		})
	})

	it("should return the original from the proxy", () => {
		produce(baseState, draftState => {
			expect(original(draftState)).toBe(baseState)
			expect(original(draftState.a)).toBe(baseState.a)
			expect(original(draftState.b)).toBe(baseState.b)
		})
	})

	it("should return undefined for new values on the draft", () => {
		produce(baseState, draftState => {
			draftState.c = {}
			draftState.d = 3
			expect(original(draftState.c)).toBeUndefined()
			expect(original(draftState.d)).toBeUndefined()
		})
	})

	it("should return undefined for an object that is not proxied", () => {
		expect(original({})).toBeUndefined()
		expect(original(3)).toBeUndefined()
	})
})
