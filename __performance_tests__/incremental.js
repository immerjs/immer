"use strict"
import {measure} from "./measure"
import produce, {setAutoFreeze, setUseProxies} from "../dist/immer.umd.js"
import cloneDeep from "lodash.clonedeep"
import * as Immutable from "immutable"
import {SortedMapAdapter} from "immerutable"

console.log("\n# incremental - lot of small incremental changes\n")

function createTestObject(order) {
    return {
        a: 1,
        b: "Some data here",
        order
    }
}

const MAX = 2000
const baseState = {
    ids: [],
    map: Object.create(null)
}

let immutableJsBaseState

immutableJsBaseState = {
    ids: Immutable.List(),
    map: Immutable.Map()
}

// An immerutable sorted map is a combination of a map and a list. It maintains
// items in sorted order and provides key-based retrieval.
const sortedMapAdapter = new SortedMapAdapter({
    getOrderingKey: item => item.order
})

let immerutableBaseState

immerutableBaseState = {
    sortedMap: sortedMapAdapter.create()
}

measure(
    "just mutate",
    () => cloneDeep(baseState),
    draft => {
        for (let i = 0; i < MAX; i++) {
            draft.ids.push(i)
            draft.map[i] = createTestObject(i)
        }
    }
)

measure(
    "handcrafted reducer",
    () => cloneDeep(baseState),
    state => {
        for (let i = 0; i < MAX; i++) {
            state = {
                ids: [...state.ids, i],
                map: {
                    ...state.map,
                    [i]: createTestObject(i)
                }
            }
        }
    }
)

measure(
    "immutableJS",
    () => immutableJsBaseState,
    state => {
        for (let i = 0; i < MAX; i++) {
            state = {
                ids: state.ids.push(i),
                map: state.map.set(i, createTestObject(i))
            }
        }
    }
)

measure(
    "immerutable (sorted map)",
    () => immerutableBaseState,
    state => {
        for (let i = 0; i < MAX; i++) {
            state = produce(state, draft => {
                sortedMapAdapter.set(draft.sortedMap, i, createTestObject(i))
            })
        }
    }
)

measure(
    "immerutable (sorted map) (reversed)",
    () => immerutableBaseState,
    state => {
        for (let i = 0; i < MAX; i++) {
            state = produce(state, draft => {
                sortedMapAdapter.set(
                    draft.sortedMap,
                    i,
                    createTestObject(MAX - i)
                )
            })
        }
    }
)

measure(
    "immer (proxy)",
    () => {
        setUseProxies(true)
        setAutoFreeze(false)
        return baseState
    },
    state => {
        for (let i = 0; i < MAX; i++) {
            state = produce(state, draft => {
                draft.ids.push(i)
                draft.map[i] = createTestObject(i)
            })
        }
    }
)

measure(
    "immer (proxy) (reversed)",
    () => {
        setUseProxies(true)
        setAutoFreeze(false)
        return baseState
    },
    state => {
        for (let i = 0; i < MAX; i++) {
            state = produce(state, draft => {
                draft.ids.splice(0, 0, i)
                draft.map[i] = createTestObject(i)
            })
        }
    }
)

measure(
    "immer (es5)",
    () => {
        setUseProxies(false)
        setAutoFreeze(false)
        return baseState
    },
    state => {
        for (let i = 0; i < MAX; i++) {
            state = produce(state, draft => {
                draft.ids.push(i)
                draft.map[i] = createTestObject(i)
            })
        }
    }
)

measure(
    "immer (proxy) - single produce",
    () => {
        setUseProxies(true)
        setAutoFreeze(false)
        return baseState
    },
    state => {
        produce(state, draft => {
            for (let i = 0; i < MAX; i++) {
                draft.ids.push(i)
                draft.map[i] = createTestObject(i)
            }
        })
    }
)

measure(
    "immer (es5) - single produce",
    () => {
        setUseProxies(false)
        setAutoFreeze(false)
        return baseState
    },
    state => {
        produce(state, draft => {
            for (let i = 0; i < MAX; i++) {
                draft.ids.push(i)
                draft.map[i] = createTestObject(i)
            }
        })
    }
)
