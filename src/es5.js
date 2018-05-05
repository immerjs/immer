"use strict"
// @ts-check

import {
    is,
    isProxyable,
    isProxy,
    PROXY_STATE,
    shallowCopy,
    RETURNED_AND_MODIFIED_ERROR,
    each,
    finalize,
    createHiddenProperty,
    isMapOrSet,
    proxyMapOrSet,
    isMap,
    isSet
} from "./common"

const descriptors = {}
let states = null

function createState(parent, proxy, base) {
    return {
        modified: false,
        hasCopy: false,
        parent,
        base,
        proxy,
        copy: undefined,
        finished: false,
        finalizing: false,
        finalized: false
    }
}

function source(state) {
    return state.hasCopy ? state.copy : state.base
}

function get(state, prop) {
    assertUnfinished(state)
    const value = source(state)[prop]
    if (!state.finalizing && value === state.base[prop] && isProxyable(value)) {
        // only create a proxy if the value is proxyable, and the value was in the base state
        // if it wasn't in the base state, the object is already modified and we will process it in finalize
        prepareCopy(state)
        return (state.copy[prop] = createProxy(state, value))
    }
    return value
}

function set(state, prop, value) {
    assertUnfinished(state)
    if (!state.modified) {
        if (is(source(state)[prop], value)) return
        markChanged(state)
        prepareCopy(state)
    }
    state.copy[prop] = value
}

function markChanged(state) {
    if (!state.modified) {
        state.modified = true
        if (state.parent) markChanged(state.parent)
    }
}

function prepareCopy(state) {
    if (state.hasCopy) return
    state.hasCopy = true
    state.copy = shallowCopy(state.base)
}

// creates a proxy for plain objects / arrays
function createProxy(parent, base) {
    const proxy = shallowCopy(base)
    each(base, i => {
        Object.defineProperty(proxy, "" + i, createPropertyProxy("" + i))
    })
    var state
    if (isMapOrSet(base)) {
        state = proxyMapOrSet(createState)(parent, base, true)
        createHiddenProperty(proxy, PROXY_STATE, state)
    } else {
        state = createState(parent, proxy, base)
        createHiddenProperty(proxy, PROXY_STATE, state)
    }
    states.push(state)
    return proxy
}

function createPropertyProxy(prop) {
    return (
        descriptors[prop] ||
        (descriptors[prop] = {
            configurable: true,
            enumerable: true,
            get() {
                return get(this[PROXY_STATE], prop)
            },
            set(value) {
                set(this[PROXY_STATE], prop, value)
            }
        })
    )
}

function assertUnfinished(state) {
    if (state.finished === true)
        throw new Error(
            "Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? " +
                JSON.stringify(state.copy || state.base)
        )
}

// this sounds very expensive, but actually it is not that expensive in practice
// as it will only visit proxies, and only do key-based change detection for objects for
// which it is not already know that they are changed (that is, only object for which no known key was changed)
function markChanges() {
    // intentionally we process the proxies in reverse order;
    // ideally we start by processing leafs in the tree, because if a child has changed, we don't have to check the parent anymore
    // reverse order of proxy creation approximates this
    for (let i = states.length - 1; i >= 0; i--) {
        const state = states[i]
        if (state.modified === false) {
            if (Array.isArray(state.base) && hasArrayChanges(state))
                markChanged(state)
            else if (isMap(state.base) && hasMapChanges(state))
                markChanged(state)
            else if (isSet(state.base) && hasSetChanges(state))
                markChanged(state)
            else if (hasObjectChanges(state)) markChanged(state)
        }
    }
}

function hasObjectChanges(state) {
    const baseKeys = Object.keys(state.base)
    const keys = Object.keys(state.proxy)
    return !shallowEqual(baseKeys, keys)
}

function hasSetChanges(state) {
    const {proxy} = state
    if (proxy.size !== state.base.size) return true
    for (var a of proxy) if (!state.base.has(a)) return true
    return false
}

function hasMapChanges(state) {
    const {proxy} = state
    if (proxy.size !== state.base.size) return true
    for (var [key, val] of proxy) {
        const v = state.base.get(key)
        if (v !== val || (v === undefined && !state.base.has(key))) {
            return true
        }
    }
    return false
}

function hasArrayChanges(state) {
    const {proxy} = state
    if (proxy.length !== state.base.length) return true
    // See #116
    // If we first shorten the length, our array interceptors will be removed.
    // If after that new items are added, result in the same original length,
    // those last items will have no intercepting property.
    // So if there is no own descriptor on the last position, we know that items were removed and added
    // N.B.: splice, unshift, etc only shift values around, but not prop descriptors, so we only have to check
    // the last one
    const descriptor = Object.getOwnPropertyDescriptor(proxy, proxy.length - 1)
    // descriptor can be null, but only for newly created sparse arrays, eg. new Array(10)
    if (descriptor && !descriptor.get) return true
    // For all other cases, we don't have to compare, as they would have been picked up by the index setters
    return false
}

export function produceEs5(baseState, producer) {
    if (isProxy(baseState)) {
        // See #100, don't nest producers
        const returnValue = producer.call(baseState, baseState)
        return returnValue === undefined ? baseState : returnValue
    }
    const prevStates = states
    states = []
    try {
        // create proxy for root
        const rootProxy = createProxy(undefined, baseState)
        // execute the thunk
        const returnValue = producer.call(rootProxy, rootProxy)
        // and finalize the modified proxy
        each(states, (_, state) => {
            state.finalizing = true
        })
        // find and mark all changes (for parts not done yet)
        // TODO: store states by depth, to be able guarantee processing leaves first
        markChanges()
        let result
        // check whether the draft was modified and/or a value was returned
        if (returnValue !== undefined && returnValue !== rootProxy) {
            // something was returned, and it wasn't the proxy itself
            if (rootProxy[PROXY_STATE].modified)
                throw new Error(RETURNED_AND_MODIFIED_ERROR)
            result = finalize(returnValue)
        } else result = finalize(rootProxy)
        // make sure all proxies become unusable
        each(states, (_, state) => {
            state.finished = true
        })
        return result
    } finally {
        states = prevStates
    }
}

function shallowEqual(objA, objB) {
    //From: https://github.com/facebook/fbjs/blob/c69904a511b900266935168223063dd8772dfc40/packages/fbjs/src/core/shallowEqual.js
    if (is(objA, objB)) return true
    if (
        typeof objA !== "object" ||
        objA === null ||
        typeof objB !== "object" ||
        objB === null
    ) {
        return false
    }
    const keysA = Object.keys(objA)
    const keysB = Object.keys(objB)
    if (keysA.length !== keysB.length) return false
    for (let i = 0; i < keysA.length; i++) {
        if (
            !hasOwnProperty.call(objB, keysA[i]) ||
            !is(objA[keysA[i]], objB[keysA[i]])
        ) {
            return false
        }
    }
    return true
}
