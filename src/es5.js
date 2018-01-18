"use strict"
// @ts-check

import {
    autoFreeze,
    isProxyable,
    isProxy,
    freeze,
    PROXY_STATE,
    finalizeNonProxiedObject,
    shallowCopy,
    verifyReturnValue,
    each
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
    if (!state.finalizing && !isProxy(value) && isProxyable(value)) {
        prepareCopy(state)
        return (state.copy[prop] = createProxy(state, value))
    }
    return value
}

function set(state, prop, value) {
    assertUnfinished(state)
    if (!state.modified) {
        if (Object.is(source(state)[prop], value)) return
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
    const proxy = Array.isArray(base)
        ? createArrayProxy(base)
        : createObjectProxy(base)
    const state = createState(parent, proxy, base)
    createHiddenProperty(proxy, PROXY_STATE, state)
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

function createObjectProxy(base) {
    const proxy = Object.assign({}, base)
    each(base, prop => {
        Object.defineProperty(proxy, prop, createPropertyProxy(prop))
    })
    return proxy
}

function createArrayProxy(base) {
    const proxy = new Array(base.length)
    each(base, i => {
        Object.defineProperty(proxy, "" + i, createPropertyProxy("" + i))
    })
    return proxy
}

function assertUnfinished(state) {
    if (state.finished === true)
        throw new Error(
            "Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process?"
        )
}

// this sounds very expensive, but actually it is not that extensive in practice
// as it will only visit proxies, and only do key-based change detection for objects for
// which it is not already know that they are changed (that is, only object for which no known key was changed)
function markChanges() {
    // intentionally we process the proxies in reverse order;
    // ideally we start by processing leafs in the tree, because if a child has changed, we don't have to check the parent anymore
    // reverse order of proxy creation approximates this
    for (let i = states.length - 1; i >= 0; i--) {
        const state = states[i]
        if (state.modified === false) {
            if (Array.isArray(state.base)) {
                if (hasArrayChanges(state)) markChanged(state)
            } else if (hasObjectChanges(state)) markChanged(state)
        }
    }
}

function hasObjectChanges(state) {
    const baseKeys = Object.keys(state.base)
    const keys = Object.keys(state.proxy)
    return !shallowEqual(baseKeys, keys)
}

function hasArrayChanges(state) {
    return state.proxy.length !== state.base.length
}

function finalize(proxy) {
    // TODO: almost litterally same as Proxy impl; let's reduce code duplication and rollup
    if (isProxy(proxy)) {
        const state = proxy[PROXY_STATE]
        if (state.modified === true) {
            if (state.finalized === true) return state.copy
            state.finalized = true
            if (Array.isArray(state.base)) return finalizeArray(proxy, state)
            return finalizeObject(proxy, state)
        } else return state.base
    } else if (proxy !== null && typeof proxy === "object") {
        finalizeNonProxiedObject(proxy, finalize)
    }
    return proxy
}

function finalizeObject(proxy, state) {
    const res = (state.copy = shallowCopy(proxy))
    const base = state.base
    each(res, (prop, value) => {
        if (value !== base[prop]) res[prop] = finalize(value)
    })
    return freeze(res)
}

function finalizeArray(proxy, state) {
    const res = (state.copy = shallowCopy(proxy))
    const base = state.base
    each(res, (i, value) => {
        if (value !== base[i]) res[i] = finalize(value)
    })
    return freeze(res)
}

export function produceEs5(baseState, producer) {
    const prevStates = states
    states = []
    try {
        // create proxy for root
        const rootClone = createProxy(undefined, baseState)
        // execute the thunk
        verifyReturnValue(producer(rootClone))
        // and finalize the modified proxy
        each(states, (_, state) => {
            state.finalizing = true
        })
        // find and mark all changes (for parts not done yet)
        // TODO: store states by depth, to be able guarantee processing leaves first
        markChanges()
        const res = finalize(rootClone)
        // make sure all proxies become unusable
        each(states, (_, state) => {
            state.finished = true
        })
        return res
    } finally {
        states = prevStates
    }
}

function shallowEqual(objA, objB) {
    //From: https://github.com/facebook/fbjs/blob/c69904a511b900266935168223063dd8772dfc40/packages/fbjs/src/core/shallowEqual.js
    if (Object.is(objA, objB)) return true
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
            !Object.is(objA[keysA[i]], objB[keysA[i]])
        ) {
            return false
        }
    }
    return true
}

function createHiddenProperty(target, prop, value) {
    Object.defineProperty(target, prop, {
        value: value,
        enumerable: false,
        writable: true
    })
}
