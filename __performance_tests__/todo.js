"use strict"
import produce, {setAutoFreeze, setUseProxies} from "../dist/immer.umd.js"
import cloneDeep from "lodash.clonedeep"
import {List, Record} from "immutable"
import deepFreeze from "deep-freeze"

function freeze(x) {
    Object.freeze(x)
    return x
}

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
    frozenBazeState = deepFreeze(cloneDeep(baseState))

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

    {
        const draft = cloneDeep(baseState)
        measure("just mutate", () => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                draft[i].done = true
            }
        })
    }

    {
        const draft = cloneDeep(baseState)
        measure("just mutate, freeze", () => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                draft[i].done = true
            }
            deepFreeze(draft)
        })
    }

    measure("deepclone, then mutate", () => {
        const draft = cloneDeep(baseState)
        for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
            draft[i].done = true
        }
    })

    measure("deepclone, then mutate, then freeze", () => {
        const draft = cloneDeep(baseState)
        for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
            draft[i].done = true
        }
        deepFreeze(draft)
    })

    measure("handcrafted reducer (no freeze)", () => {
        const nextState = [
            ...baseState.slice(0, MAX * MODIFY_FACTOR).map(todo => ({
                ...todo,
                done: true
            })),
            ...baseState.slice(MAX * MODIFY_FACTOR)
        ]
    })

    measure("handcrafted reducer (with freeze)", () => {
        const nextState = freeze([
            ...baseState.slice(0, MAX * MODIFY_FACTOR).map(todo =>
                freeze({
                    ...todo,
                    done: true
                })
            ),
            ...baseState.slice(MAX * MODIFY_FACTOR)
        ])
    })

    measure("naive handcrafted reducer (without freeze)", () => {
        const nextState = baseState.map((todo, index) => {
            if (index < MAX * MODIFY_FACTOR)
                return {
                    ...todo,
                    done: true
                }
            else return todo
        })
    })

    measure("naive handcrafted reducer (with freeze)", () => {
        const nextState = deepFreeze(
            baseState.map((todo, index) => {
                if (index < MAX * MODIFY_FACTOR)
                    return {
                        ...todo,
                        done: true
                    }
                else return todo
            })
        )
    })

    measure("immutableJS", () => {
        let state = immutableJsBaseState
        state.withMutations(state => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                state.setIn([i, "done"], true)
            }
        })
    })

    measure("immutableJS + toJS", () => {
        let state = immutableJsBaseState
            .withMutations(state => {
                for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                    state.setIn([i, "done"], true)
                }
            })
            .toJS()
    })

    measure("immer (proxy) - without autofreeze", () => {
        setUseProxies(true)
        setAutoFreeze(false)
        produce(baseState, draft => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                draft[i].done = true
            }
        })
    })

    measure("immer (proxy) - with autofreeze", () => {
        setUseProxies(true)
        setAutoFreeze(true)
        produce(frozenBazeState, draft => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                draft[i].done = true
            }
        })
    })

    measure("immer (es5) - without autofreeze", () => {
        setUseProxies(false)
        setAutoFreeze(false)
        produce(baseState, draft => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                draft[i].done = true
            }
        })
    })

    measure("immer (es5) - with autofreeze", () => {
        setUseProxies(false)
        setAutoFreeze(true)
        produce(frozenBazeState, draft => {
            for (let i = 0; i < MAX * MODIFY_FACTOR; i++) {
                draft[i].done = true
            }
        })
    })
})
