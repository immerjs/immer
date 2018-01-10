"use strict"
import produce from "../src/immer"

describe("readme example", () => {
    it("works", () => {
        const baseState = [
            {
                todo: "Learn typescript",
                done: true
            },
            {
                todo: "Try immer",
                done: false
            }
        ]

        const nextState = produce(baseState, draft => {
            draft.push({todo: "Tweet about it"})
            draft[1].done = true
        })

        // the new item is only added to the next state,
        // base state is unmodified
        expect(baseState.length).toBe(2)
        expect(nextState.length).toBe(3)

        // same for the changed 'done' prop
        expect(baseState[1].done).toBe(false)
        expect(nextState[1].done).toBe(true)

        // unchanged data is structurally shared
        expect(nextState[0]).toBe(baseState[0])
        // changed data not (dûh)
        expect(nextState[1]).not.toBe(baseState[1])
    })
})
