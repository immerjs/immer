"use strict"
import immer, {setAutoFreeze} from ".."
import cloneDeep from "lodash.clonedeep"
import {List, Record} from "immutable"

describe("performance", () => {
    const MAX = 100000
    const MODIFY_FACTOR = 0.1
    const baseState = []
    let frozenBazeState
    let immutableJsBaseState

    // produce the base state
    for (let i = 0; i < MAX; i++) {
        baseState.push({
            todo: "todo_" + i,
            done: false,
            someThingCompletelyIrrelevant: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
        })
    }

    // Produce the frozen bazeState
    frozenBazeState = baseState.map(todo => {
        const newTodo = {...todo}
        newTodo.someThingCompletelyIrrelevant = todo.someThingCompletelyIrrelevant.slice()
        Object.freeze(newTodo.someThingCompletelyIrrelevant)
        Object.freeze(newTodo)
        return newTodo
    })
    Object.freeze(frozenBazeState)

    // generate immutalbeJS base state
    const todoRecord = Record({
        todo: "",
        done: false,
        someThingCompletelyIrrelevant: []
    })
    immutableJsBaseState = List(baseState.map(todo => todoRecord(todo)))

    // The benchmarks

    test("just mutate", () => {
        for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
            baseState[i].done = true
        }
    })

    test("deepclone, then mutate", () => {
        const draft = cloneDeep(baseState)
        for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
            draft[i].done = true
        }
    })

    test("handcrafted reducer", () => {
        const nextState = [
            ...baseState.slice(0, MAX * MODIFY_FACTOR).map(todo => ({
                ...todo,
                done: true
            })),
            ...baseState.slice(MAX * MODIFY_FACTOR)
        ]
    })

    test("immutableJS", () => {
        let state = immutableJsBaseState
        state.withMutations(state => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                state.setIn([i, "done"], true)
            }
        })
    })

    test("immer - with autofreeze", () => {
        setAutoFreeze(true)
        immer(frozenBazeState, draft => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                draft[i].done = true
            }
        })
    })

    test("immer - without autofreeze", () => {
        setAutoFreeze(false)
        immer(baseState, draft => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                draft[i].done = true
            }
        })
        setAutoFreeze(true)
    })
})
