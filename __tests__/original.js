"use strict"
import produce, {original} from "../src/immer"

describe("original", () => {
    const baseState = {
        a: [],
        b: {}
    }

    it("should return the original from the proxy", () => {
        const nextState = produce(baseState, draftState => {
            expect(original(draftState)).toBe(baseState)
            expect(original(draftState.a)).toBe(baseState.a)
            expect(original(draftState.b)).toBe(baseState.b)
        })
    })

    it("should return the same object from an object that is not proxied", () => {
        const a = []
        expect(original(a)).toBe(a)
    })
})
