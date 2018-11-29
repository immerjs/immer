"use strict"
// @ts-check

import {
    assign,
    each,
    has,
    is,
    isProxyable,
    isProxy,
    finalize,
    shallowCopy,
    PROXY_STATE,
    RETURNED_AND_MODIFIED_ERROR
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
arrayTraps.deleteProperty = function(state, prop) {
    if (isNaN(parseInt(prop)))
        throw new Error(
            "Immer does not support deleting properties from arrays: " + prop
        )
    return objectTraps.deleteProperty.call(this, state[0], prop)
}
arrayTraps.set = function(state, prop, value) {
    if (prop !== "length" && isNaN(parseInt(prop)))
        throw new Error(
            "Immer does not support setting non-numeric properties on arrays: " +
                prop
        )
    return objectTraps.set.call(this, state[0], prop, value)
}

function createState(parent, base) {
    return {
        modified: false, // this tree is modified (either this object or one of it's children)
        assigned: {}, // true: value was assigned to these props, false: was removed
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
    // TODO: optimize
    state.assigned[prop] = true
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
    state.assigned[prop] = false
    markChanged(state)
    delete state.copy[prop]
    return true
}

function getOwnPropertyDescriptor(state, prop) {
    const owner = state.modified
        ? state.copy
        : has(state.proxies, prop)
            ? state.proxies
            : state.base
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

function markChanged(state) {
    if (!state.modified) {
        state.modified = true
        state.copy = shallowCopy(state.base)
        // copy the proxies over the base-copy
        assign(state.copy, state.proxies) // yup that works for arrays as well
        if (state.parent) markChanged(state.parent)
    }
}

// creates a proxy for plain objects / arrays
function createProxy(parentState, base) {
    if (isProxy(base)) throw new Error("Immer bug. Plz report.")
    const state = createState(parentState, base)
    const proxy = Array.isArray(base)
        ? Proxy.revocable([state], arrayTraps)
        : Proxy.revocable(state, objectTraps)
    proxies.push(proxy)
    return proxy.proxy
}

export function produceProxy(baseState, producer, patchListener) {
    const previousProxies = proxies
    proxies = []
    const patches = patchListener && []
    const inversePatches = patchListener && []
    try {
        // create proxy for root
        const rootProxy = createProxy(undefined, baseState)
        // execute the producer function
        const returnValue = producer.call(rootProxy, rootProxy)
        // and finalize the modified proxy
        let result
        // check whether the draft was modified and/or a value was returned
        if (returnValue !== undefined && returnValue !== rootProxy) {
            // something was returned, and it wasn't the proxy itself
            if (rootProxy[PROXY_STATE].modified)
                throw new Error(RETURNED_AND_MODIFIED_ERROR)

            // we need to finalize the return value in case it's a subset of the draft
            result = finalize(returnValue)
            if (patches) {
                patches.push({op: "replace", path: [], value: result})
                inversePatches.push({op: "replace", path: [], value: baseState})
            }
        } else {
            result = finalize(rootProxy, [], patches, inversePatches)
        }
        // revoke all proxies
        each(proxies, (_, p) => p.revoke())
        patchListener && patchListener(patches, inversePatches)
        return result
    } finally {
        proxies = previousProxies
    }
}
