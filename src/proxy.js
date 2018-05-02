"use strict"
// @ts-check

import {
    is,
    has,
    isProxyable,
    isProxy,
    PROXY_STATE,
    finalize,
    shallowCopy,
    RETURNED_AND_MODIFIED_ERROR,
    each,
    isMapOrSet,
    markChanged,
    proxyMapOrSet,
    createState
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
        throw new Error("Immer does not support `setPrototypeOf()`.")
    }
}

const arrayTraps = {}
each(objectTraps, (key, fn) => {
    arrayTraps[key] = function() {
        arguments[0] = arguments[0][0]
        return fn.apply(this, arguments)
    }
})

function source(state) {
    return state.modified === true ? state.copy : state.base
}

function get(state, prop) {
    if (prop === PROXY_STATE) return state
    if (state.modified) {
        const value = state.copy[prop]
        if (value === state.base[prop] && isProxyable(value))
            // only create proxy if it is not yet a proxy, and not a new object
            // (new objects don't need proxying, they will be processed in finalize anyway)
            return (state.copy[prop] = createProxy(state, value))
        return value
    } else {
        if (has(state.proxies, prop)) return state.proxies[prop]
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
            (has(state.proxies, prop) && state.proxies[prop] === value)
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
        : has(state.proxies, prop) ? state.proxies : state.base
    const descriptor = Reflect.getOwnPropertyDescriptor(owner, prop)
    if (descriptor && !(Array.isArray(owner) && prop === "length"))
        descriptor.configurable = true
    return descriptor
}

function defineProperty() {
    throw new Error(
        "Immer does not support defining properties on draft objects."
    )
}

// creates a proxy for plain objects / arrays
function createProxy(parentState, base) {
    if (isProxy(base)) throw new Error("Immer bug. Plz report.")
    const state = createState(parentState, base)
    var proxy
    if (Array.isArray(base)) {
        proxy = Proxy.revocable([state], arrayTraps)
    } else if (isMapOrSet(base)) {
        proxy = proxyMapOrSet(parentState, base)
    } else {
        proxy = Proxy.revocable(state, objectTraps)
    }
    proxies.push(proxy)
    return proxy.proxy
}

export function produceProxy(baseState, producer) {
    if (isProxy(baseState)) {
        // See #100, don't nest producers
        const returnValue = producer.call(baseState, baseState)
        return returnValue === undefined ? baseState : returnValue
    }
    const previousProxies = proxies
    proxies = []
    try {
        // create proxy for root
        const rootProxy = createProxy(undefined, baseState)
        // execute the thunk
        const returnValue = producer.call(rootProxy, rootProxy)
        // and finalize the modified proxy
        let result
        // check whether the draft was modified and/or a value was returned
        if (returnValue !== undefined && returnValue !== rootProxy) {
            // something was returned, and it wasn't the proxy itself
            if (rootProxy[PROXY_STATE].modified)
                throw new Error(RETURNED_AND_MODIFIED_ERROR)

            // See #117
            // Should we just throw when returning a proxy which is not the root, but a subset of the original state?
            // Looks like a wrongly modeled reducer
            result = finalize(returnValue)
        } else {
            result = finalize(rootProxy)
        }
        // revoke all proxies
        each(proxies, (_, p) => p.revoke && p.revoke())
        return result
    } finally {
        proxies = previousProxies
    }
}
