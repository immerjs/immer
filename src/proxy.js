"use strict"
// @ts-check

import {
    assign,
    each,
    has,
    is,
    isDraftable,
    isDraft,
    shallowCopy,
    DRAFT_STATE
} from "./common"

// For nested produce calls:
export const scopes = []
export const currentScope = () => scopes[scopes.length - 1]

// Do nothing before being finalized.
export function willFinalize() {}

export function createDraft(base, parent) {
    if (isDraft(base)) throw new Error("This should never happen. Please report: https://github.com/mweststrate/immer/issues/new") // prettier-ignore

    const state = {
        modified: false, // this tree is modified (either this object or one of it's children)
        assigned: {}, // true: value was assigned to these props, false: was removed
        parent,
        base,
        draft: null, // the root proxy
        drafts: {}, // proxied properties
        copy: null,
        revoke: null,
        finalized: false
    }

    const {revoke, proxy} = Array.isArray(base)
        ? Proxy.revocable([state], arrayTraps)
        : Proxy.revocable(state, objectTraps)

    state.draft = proxy
    state.revoke = revoke

    currentScope().push(state)
    return proxy
}

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

function source(state) {
    return state.modified === true ? state.copy : state.base
}

function get(state, prop) {
    if (prop === DRAFT_STATE) return state
    if (state.modified) {
        const value = state.copy[prop]
        if (value === state.base[prop] && isDraftable(value))
            // only create proxy if it is not yet a proxy, and not a new object
            // (new objects don't need proxying, they will be processed in finalize anyway)
            return (state.copy[prop] = createDraft(value, state))
        return value
    } else {
        if (has(state.drafts, prop)) return state.drafts[prop]
        const value = state.base[prop]
        if (!isDraft(value) && isDraftable(value))
            return (state.drafts[prop] = createDraft(value, state))
        return value
    }
}

function set(state, prop, value) {
    if (!state.modified) {
        // Optimize based on value's truthiness. Truthy values are guaranteed to
        // never be undefined, so we can avoid the `in` operator. Lastly, truthy
        // values may be drafts, but falsy values are never drafts.
        const isUnchanged = value
            ? is(state.base[prop], value) || value === state.drafts[prop]
            : is(state.base[prop], value) && prop in state.base
        if (isUnchanged) return true
        markChanged(state)
    }
    state.assigned[prop] = true
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
        : has(state.drafts, prop)
        ? state.drafts
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
        // copy the drafts over the base-copy
        assign(state.copy, state.drafts) // yup that works for arrays as well
        if (state.parent) markChanged(state.parent)
    }
}
