"use strict"
import produce, {original, setUseProxies, enableAllPlugins} from "../src/immer"

enableAllPlugins()

const isProd = process.env.NODE_ENV === "production"

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

	it("should throw undefined for new values on the draft", () => {
		produce(baseState, draftState => {
			draftState.c = {}
			draftState.d = 3
			expect(() => original(draftState.c)).toThrowErrorMatchingInlineSnapshot(
				isProd
					? `"[Immer] minified error nr: 23 '[object Object]'. Find the full error at: https://bit.ly/3cXEKWf"`
					: `"[Immer] 'original' expects a draft, got: [object Object]"`
			)
			expect(() => original(draftState.d)).toThrowErrorMatchingInlineSnapshot(
				isProd
					? `"[Immer] minified error nr: 23 '3'. Find the full error at: https://bit.ly/3cXEKWf"`
					: `"[Immer] 'original' expects a draft, got: 3"`
			)
		})
	})

	it("should return undefined for an object that is not proxied", () => {
		expect(() => original({})).toThrowErrorMatchingInlineSnapshot(
			isProd
				? `"[Immer] minified error nr: 23 '[object Object]'. Find the full error at: https://bit.ly/3cXEKWf"`
				: `"[Immer] 'original' expects a draft, got: [object Object]"`
		)
		expect(() => original(3)).toThrowErrorMatchingInlineSnapshot(
			isProd
				? `"[Immer] minified error nr: 23 '3'. Find the full error at: https://bit.ly/3cXEKWf"`
				: `"[Immer] 'original' expects a draft, got: 3"`
		)
	})
})
