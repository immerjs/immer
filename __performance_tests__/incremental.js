"use strict"
import produce, {setAutoFreeze, setUseProxies} from "../dist/immer.umd.js"
import cloneDeep from "lodash.clonedeep"
import * as Immutable from "immutable"
import deepFreeze from "deep-freeze"

function freeze(x) {
    Object.freeze(x)
    return x
}

function createTestObject() {
    return {
        a: 1,
        b: "Some data here"
    }
}

describe("Incremental performance", () => {
    const MAX = 4000
    const baseState = {
        ids: [],
        map: Object.create(null)
    }

    let immutableJsBaseState

    immutableJsBaseState = {
        ids: Immutable.List(),
        map: Immutable.Map()
    }

    function measure(name, fn) {
        global.gc && global.gc()
        test(name, fn)
    }

    {
        const draft = cloneDeep(baseState)
        measure("just mutate", () => {
            for (let i = 0; i < MAX; i++) {
                draft.ids.push(i)
                draft.map[i] = createTestObject()
            }
        })
    }

    measure("handcrafted reducer (no freeze)", () => {
        let state = cloneDeep(baseState)

        for (let i = 0; i < MAX; i++) {
            state = {
                ids: [...state.ids, i],
                map: {
                    ...state.map,
                    [i]: createTestObject()
                }
            }
        }
    })

    measure("immutableJS", () => {
        let state = immutableJsBaseState
        for (let i = 0; i < MAX; i++) {
            state = {
                ids: state.ids.push(i),
                map: state.map.set(i, createTestObject())
            }
        }
    })

    measure("immer (proxy) - without autofreeze", () => {
        setUseProxies(true)
        setAutoFreeze(false)
        let state = baseState

        for (let i = 0; i < MAX; i++) {
            state = produce(state, draft => {
                draft.ids.push(i)
                draft.map[i] = createTestObject()
            })
        }
    })
})
