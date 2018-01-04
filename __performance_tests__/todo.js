"use strict"
import immerProxy, {setAutoFreeze as setAutoFreezeProxy} from ".."
import immerEs5, {setAutoFreeze as setAutoFreezeEs5} from "../es5"
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

    function measure(name, fn) {
        global.gc && global.gc()
        test(name, fn)
    }

    measure("just mutate", () => {
        for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
            baseState[i].done = true
        }
    })

    measure("deepclone, then mutate", () => {
        const draft = cloneDeep(baseState)
        for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
            draft[i].done = true
        }
    })

    measure("handcrafted reducer", () => {
        const nextState = [
            ...baseState.slice(0, MAX * MODIFY_FACTOR).map(todo => ({
                ...todo,
                done: true
            })),
            ...baseState.slice(MAX * MODIFY_FACTOR)
        ]
    })

    measure("immutableJS", () => {
        let state = immutableJsBaseState
        state.withMutations(state => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                state.setIn([i, "done"], true)
            }
        })
    })

    measure("immer (proxy) - with autofreeze", () => {
        setAutoFreezeProxy(true)
        immerProxy(frozenBazeState, draft => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                draft[i].done = true
            }
        })
    })

    measure("immer (proxy) - without autofreeze", () => {
        setAutoFreezeProxy(false)
        immerProxy(baseState, draft => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                draft[i].done = true
            }
        })
        setAutoFreezeProxy(true)
    })

    measure("immer (es5) - with autofreeze", () => {
        setAutoFreezeEs5(true)
        immerEs5(frozenBazeState, draft => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                draft[i].done = true
            }
        })
    })

    measure("immer (es5) - without autofreeze", () => {
        setAutoFreezeEs5(false)
        immerEs5(baseState, draft => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                draft[i].done = true
            }
        })
        setAutoFreezeEs5(true)
    })
})
