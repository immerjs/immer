"use strict"
import produce from "../src/immer"

describe("null functionality", () => {
	const baseState = null

	it("should return the original without modifications", () => {
		expect(() =>
			produce(baseState, () => {})
		).toThrowErrorMatchingInlineSnapshot(
			`"[Immer] produce can only be called on things that are draftable: plain objects, arrays, Map, Set or classes that are marked with '[immerable]: true'. Got 'null'"`
		)
	})
})
