"use strict"
// @ts-check

import {
    each,
    has,
    is,
    isProxy,
    isProxyable,
    shallowCopy,
    PROXY_STATE
} from "./common"

const descriptors = {}

// For nested produce calls:
export const scopes = []
export const currentScope = () => scopes[scopes.length - 1]

export function willFinalize(result, baseDraft, needPatches) {
    const scope = currentScope()
    scope.forEach(state => (state.finalizing = true))
    if (result === undefined || result === baseDraft) {
        if (needPatches) markChangesRecursively(baseDraft)
        // This is faster when we don't care about which attributes changed.
        markChangesSweep(scope)
    }
}

export function createProxy(base, parent) {
    if (isProxy(base)) throw new Error("This should never happen. Please report: https://github.com/mweststrate/immer/issues/new") // prettier-ignore

    const proxy = shallowCopy(base)
    each(base, prop => {
        Object.defineProperty(proxy, "" + prop, createPropertyProxy("" + prop))
    })

    const state = {
        modified: false,
        finalizing: false,
        finalized: false,
        assigned: {}, // true: value was assigned to these props, false: was removed
        parent,
        base,
        proxy,
        copy: null,
        revoke,
        revoked: false
    }

    createHiddenProperty(proxy, PROXY_STATE, state)
    currentScope().push(state)
    return proxy
}

function revoke() {
    this.revoked = true
}

function source(state) {
    return state.copy || state.base
}

function get(state, prop) {
    assertUnrevoked(state)
    const value = source(state)[prop]
    // Drafts are only created for proxyable values that exist in the base state.
    if (!state.finalizing && value === state.base[prop] && isProxyable(value)) {
        prepareCopy(state)
        return (state.copy[prop] = createProxy(value, state))
    }
    return value
}

function set(state, prop, value) {
    assertUnrevoked(state)
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
    if (!state.copy) state.copy = shallowCopy(state.base)
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

function assertUnrevoked(state) {
    if (state.revoked === true)
        throw new Error(
            "Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? " +
                JSON.stringify(state.copy || state.base)
        )
}

// This looks expensive, but only proxies are visited, and only objects without known changes are scanned.
function markChangesSweep(scope) {
    // The natural order of proxies in the `scope` array is based on when they
    // were accessed. By processing proxies in reverse natural order, we have a
    // better chance of processing leaf nodes first. When a leaf node is known to
    // have changed, we can avoid any traversal of its ancestor nodes.
    for (let i = scope.length - 1; i >= 0; i--) {
        const state = scope[i]
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
    const {base, proxy, assigned} = state
    if (!Array.isArray(object)) {
        // Look for added keys.
        Object.keys(proxy).forEach(key => {
            // The `undefined` check is a fast path for pre-existing keys.
            if (base[key] === undefined && !has(base, key)) {
                assigned[key] = true
                markChanged(state)
            } else if (!assigned[key]) {
                // Only untouched properties trigger recursion.
                markChangesRecursively(proxy[key])
            }
        })
        // Look for removed keys.
        Object.keys(base).forEach(key => {
            // The `undefined` check is a fast path for pre-existing keys.
            if (proxy[key] === undefined && !has(proxy, key)) {
                assigned[key] = false
                markChanged(state)
            }
        })
    } else if (hasArrayChanges(state)) {
        markChanged(state)
        assigned.length = true
        if (proxy.length < base.length) {
            for (let i = proxy.length; i < base.length; i++) assigned[i] = false
        } else {
            for (let i = base.length; i < proxy.length; i++) assigned[i] = true
        }
        for (let i = 0; i < proxy.length; i++) {
            // Only untouched indices trigger recursion.
            if (assigned[i] === undefined) markChangesRecursively(proxy[i])
        }
    }
}

function hasObjectChanges(state) {
    const {base, proxy} = state

    // Search for added keys. Start at the back, because non-numeric keys
    // are ordered by time of definition on the object.
    const keys = Object.keys(proxy)
    for (let i = keys.length - 1; i >= 0; i--) {
        // The `undefined` check is a fast path for pre-existing keys.
        if (base[keys[i]] === undefined && !has(base, keys[i])) {
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

function createHiddenProperty(target, prop, value) {
    Object.defineProperty(target, prop, {
        value: value,
        enumerable: false,
        writable: true
    })
}
