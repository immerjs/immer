"use strict"

import produce, {setAutoFreeze, setUseProxies} from "../dist/immer.umd.js"
import cloneDeep from "lodash.clonedeep"
import {fromJS} from "immutable"
import deepFreeze from "deep-freeze"

describe("loading large set of data", () => {
    const dataSet = require("./data.json")
    const baseState = {
        data: null
    }
    const frozenBazeState = deepFreeze(cloneDeep(baseState))
    const immutableJsBaseState = fromJS(baseState)

    function measure(name, fn) {
        global.gc && global.gc()
        test(name, fn)
    }

    {
        const draft = cloneDeep(baseState)
        measure("just mutate", () => {
            draft.data = dataSet
        })
    }

    {
        const draft = cloneDeep(baseState)
        measure("just mutate, freeze", () => {
            draft.data = dataSet
            deepFreeze(draft)
        })
    }

    measure("handcrafted reducer (no freeze)", () => {
        const nextState = {
            ...baseState,
            data: dataSet
        }
    })

    measure("handcrafted reducer (with freeze)", () => {
        const nextState = deepFreeze({
            ...baseState,
            data: dataSet
        })
    })

    measure("immutableJS", () => {
        let state = immutableJsBaseState.withMutations(state => {
            state.setIn(["data"], fromJS(dataSet))
        })
    })

    measure("immutableJS + toJS", () => {
        let state = immutableJsBaseState
            .withMutations(state => {
                state.setIn(["data"], fromJS(dataSet))
            })
            .toJS()
    })

    measure("immer (proxy) - without autofreeze", () => {
        setUseProxies(true)
        setAutoFreeze(false)
        produce(baseState, draft => {
            draft.data = dataSet
        })
    })

    measure("immer (proxy) - with autofreeze", () => {
        setUseProxies(true)
        setAutoFreeze(true)
        produce(frozenBazeState, draft => {
            draft.data = dataSet
        })
    })

    measure("immer (es5) - without autofreeze", () => {
        setUseProxies(false)
        setAutoFreeze(false)
        produce(baseState, draft => {
            draft.data = dataSet
        })
    })

    measure("immer (es5) - with autofreeze", () => {
        setUseProxies(false)
        setAutoFreeze(true)
        produce(frozenBazeState, draft => {
            draft.data = dataSet
        })
    })
})
