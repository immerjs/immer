"use strict"
// @ts-check

import {
    is,
    isProxyable,
    PROXY_STATE,
    shallowCopy,
    RETURNED_AND_MODIFIED_ERROR,
    has,
    each,
    finalize
} from "./common"

const descriptors = {}
let states = null

function createState(parent, proxy, base) {
    return {
        modified: false,
        assigned: {}, // true: value was assigned to these props, false: was removed
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
    state.assigned[prop] = true // optimization; skip this if there is no listener
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
function markChangesSweep() {
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

function markChangesRecursively(object) {
    if (!object || typeof object !== "object") return
    const state = object[PROXY_STATE]
    if (!state) return
    const {proxy, base} = state
    if (Array.isArray(object)) {
        if (hasArrayChanges(state)) {
            markChanged(state)
            state.assigned.length = true
            if (proxy.length < base.length)
                for (let i = proxy.length; i < base.length; i++)
                    state.assigned[i] = false
            else
                for (let i = base.length; i < proxy.length; i++)
                    state.assigned[i] = true
            each(proxy, (index, child) => {
                if (!state.assigned[index]) markChangesRecursively(child)
            })
        }
    } else {
        const {added, removed} = diffKeys(base, proxy)
        if (added.length > 0 || removed.length > 0) markChanged(state)
        each(added, (_, key) => {
            state.assigned[key] = true
        })
        each(removed, (_, key) => {
            state.assigned[key] = false
        })
        each(proxy, (key, child) => {
            if (!state.assigned[key]) markChangesRecursively(child)
        })
    }
}

function diffKeys(from, to) {
    // TODO: optimize
    const a = Object.keys(from)
    const b = Object.keys(to)
    return {
        added: b.filter(key => a.indexOf(key) === -1),
        removed: a.filter(key => b.indexOf(key) === -1)
    }
}

function hasObjectChanges(state) {
    const {base, proxy} = state

    // Search for added keys. Start at the back, because non-numeric keys
    // are ordered by time of definition on the object.
    const keys = Object.keys(proxy)
    for (let i = keys.length; i !== 0; ) {
        const key = keys[--i]

        // The `undefined` check is a fast path for pre-existing keys.
        if (base[key] === undefined && !has(base, key)) {
            return true
        }
    }

    // Since no keys have been added, we can compare lengths to know if an
    // object has been deleted.
    return keys.length !== Object.keys(base).length
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

export function produceEs5(baseState, producer, patchListener) {
    const prevStates = states
    states = []
    const patches = patchListener && []
    const inversePatches = patchListener && []
    try {
        // create proxy for root
        const rootProxy = createProxy(undefined, baseState)
        // execute the thunk
        const returnValue = producer.call(rootProxy, rootProxy)
        // and finalize the modified proxy
        each(states, (_, state) => {
            state.finalizing = true
        })
        let result
        // check whether the draft was modified and/or a value was returned
        if (returnValue !== undefined && returnValue !== rootProxy) {
            // something was returned, and it wasn't the proxy itself
            if (rootProxy[PROXY_STATE].modified)
                throw new Error(RETURNED_AND_MODIFIED_ERROR)
            result = finalize(returnValue)
            if (patches) {
                patches.push({op: "replace", path: [], value: result})
                inversePatches.push({op: "replace", path: [], value: baseState})
            }
        } else {
            if (patchListener) markChangesRecursively(rootProxy)
            markChangesSweep() // this one is more efficient if we don't need to know which attributes have changed
            result = finalize(rootProxy, [], patches, inversePatches)
        }
        // make sure all proxies become unusable
        each(states, (_, state) => {
            state.finished = true
        })
        patchListener && patchListener(patches, inversePatches)
        return result
    } finally {
        states = prevStates
    }
}

function createHiddenProperty(target, prop, value) {
    Object.defineProperty(target, prop, {
        value: value,
        enumerable: false,
        writable: true
    })
}
