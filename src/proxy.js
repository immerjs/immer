"use strict"
// @ts-check

import {
    is,
    isProxyable,
    isProxy,
    freeze,
    PROXY_STATE,
    finalize,
    shallowCopy,
    verifyReturnValue,
    each
} from "./common"

let proxies = null

const objectTraps = {
    get,
    has(target, prop) {
        return prop in source(target)
    },
    ownKeys(target) {
        return Reflect.ownKeys(source(target))
    },
    set,
    deleteProperty,
    getOwnPropertyDescriptor,
    defineProperty,
    setPrototypeOf() {
        throw new Error("Don't even try this...")
    }
}

const arrayTraps = {}
each(objectTraps, (key, fn) => {
    arrayTraps[key] = function() {
        arguments[0] = arguments[0][0]
        return fn.apply(this, arguments)
    }
})

function createState(parent, base) {
    return {
        modified: false,
        finalized: false,
        parent,
        base,
        copy: undefined,
        proxies: {}
    }
}

function source(state) {
    return state.modified === true ? state.copy : state.base
}

function get(state, prop) {
    if (prop === PROXY_STATE) return state
    if (state.modified) {
        const value = state.copy[prop]
        if (!isProxy(value) && isProxyable(value))
            return (state.copy[prop] = createProxy(state, value))
        return value
    } else {
        if (prop in state.proxies) return state.proxies[prop]
        const value = state.base[prop]
        if (!isProxy(value) && isProxyable(value))
            return (state.proxies[prop] = createProxy(state, value))
        return value
    }
}

function set(state, prop, value) {
    if (!state.modified) {
        if (
            (prop in state.base && is(state.base[prop], value)) ||
            (prop in state.proxies && state.proxies[prop] === value)
        )
            return true
        markChanged(state)
    }
    state.copy[prop] = value
    return true
}

function deleteProperty(state, prop) {
    markChanged(state)
    delete state.copy[prop]
    return true
}

function getOwnPropertyDescriptor(state, prop) {
    const owner = state.modified
        ? state.copy
        : prop in state.proxies ? state.proxies : state.base
    const descriptor = Reflect.getOwnPropertyDescriptor(owner, prop)
    if (descriptor && !(Array.isArray(owner) && prop === "length"))
        descriptor.configurable = true
    return descriptor
}

function defineProperty() {
    throw new Error(
        "Immer does currently not support defining properties on draft objects"
    )
}

function markChanged(state) {
    if (!state.modified) {
        state.modified = true
        state.copy = shallowCopy(state.base)
        // copy the proxies over the base-copy
        Object.assign(state.copy, state.proxies) // yup that works for arrays as well
        if (state.parent) markChanged(state.parent)
    }
}

// creates a proxy for plain objects / arrays
function createProxy(parentState, base) {
    const state = createState(parentState, base)
    const proxy = Array.isArray(base)
        ? Proxy.revocable([state], arrayTraps)
        : Proxy.revocable(state, objectTraps)
    proxies.push(proxy)
    return proxy.proxy
}

export function finalizeObject(state) {
    const copy = state.copy
    const base = state.base
    each(copy, (prop, value) => {
        if (value !== base[prop]) copy[prop] = finalize(value)
    })
    return freeze(copy)
}

export function finalizeArray(state) {
    const copy = state.copy
    const base = state.base
    each(copy, (i, value) => {
        if (value !== base[i]) copy[i] = finalize(value)
    })
    return freeze(copy)
}

export function produceProxy(baseState, producer) {
    const previousProxies = proxies
    proxies = []
    try {
        // create proxy for root
        const rootClone = createProxy(undefined, baseState)
        // execute the thunk
        verifyReturnValue(producer(rootClone))
        // and finalize the modified proxy
        const res = finalize(rootClone)
        // revoke all proxies
        each(proxies, (_, p) => p.revoke())
        return res
    } finally {
        proxies = previousProxies
    }
}
