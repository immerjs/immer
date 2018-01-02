"use strict"
import immer from ".."

describe("auto freeze", () => {
    const baseState = {
        object: {a: 1},
        array: [1, 2]
    }

    it("should freeze objects after modifications", () => {
        expect(Object.isFrozen(baseState.object)).toBe(false) // initially not frozen
        const next = immer(baseState, draft => {
            draft.object.c = 2
        })
        expect(Object.isFrozen(next.object)).toBe(true)
        expect(Object.isFrozen(next)).toBe(true)
        expect(Object.isFrozen(next.array)).toBe(false)

        expect(() => {
            next.object.a = 2
        }).toThrow(/Cannot assign to read only property/)
    })

    it("should freeze arrays after modifications", () => {
        expect(Object.isFrozen(baseState.object)).toBe(false) // initially not frozen
        const next = immer(baseState, draft => {
            draft.array.push(3)
        })
        expect(Object.isFrozen(next.object)).toBe(false) // not touched
        expect(Object.isFrozen(next)).toBe(true)
        expect(Object.isFrozen(next.array)).toBe(true)

        expect(() => {
            next.array.shift()
        }).toThrow(/Cannot add\/remove sealed array elements/)
    })

    it("can handle already frozen trees", () => {
        const a = []
        const b = {a: a}
        Object.freeze(a)
        Object.freeze(b)
        const n = immer(b, draft => {
            draft.c = true
            draft.a.push(3)
        })
        expect(n).toEqual({c: true, a: [3]})
    })
})
