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
    const state = {
        // Track which produce call this is associated with.
        scope: parent ? parent.scope : currentScope(),
        // True for both shallow and deep changes.
        modified: false,
        // Used during finalization.
        finalized: false,
        // Track which properties have been assigned (true) or deleted (false).
        assigned: {},
        // The parent draft state.
        parent,
        // The base state.
        base,
        // The base proxy.
        draft: null,
        // Any property proxies.
        drafts: {},
        // The base copy with any updated values.
        copy: null,
        // Called by the `produce` function.
        revoke: null
    }

    const {revoke, proxy} = Array.isArray(base)
        ? Proxy.revocable([state], arrayTraps)
        : Proxy.revocable(state, objectTraps)

    state.draft = proxy
    state.revoke = revoke

    state.scope.push(state)
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
    defineProperty() {
        throw new Error("Object.defineProperty() cannot be used on an Immer draft") // prettier-ignore
    },
    getPrototypeOf(target) {
        return Object.getPrototypeOf(target.base)
    },
    setPrototypeOf() {
        throw new Error("Object.setPrototypeOf() cannot be used on an Immer draft") // prettier-ignore
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
    if (isNaN(parseInt(prop))) {
        throw new Error("Immer only supports deleting array indices") // prettier-ignore
    }
    return objectTraps.deleteProperty.call(this, state[0], prop)
}
arrayTraps.set = function(state, prop, value) {
    if (prop !== "length" && isNaN(parseInt(prop))) {
        throw new Error("Immer only supports setting array indices and the 'length' property") // prettier-ignore
    }
    return objectTraps.set.call(this, state[0], prop, value)
}

function source(state) {
    return state.copy || state.base
}

function get(state, prop) {
    if (prop === DRAFT_STATE) return state
    let {drafts} = state

    // Check for existing draft in unmodified state.
    if (!state.modified && has(drafts, prop)) {
        return drafts[prop]
    }

    const value = source(state)[prop]
    if (state.finalized || !isDraftable(value)) return value

    // Check for existing draft in modified state.
    if (state.modified) {
        // Assigned values are never drafted. This catches any drafts we created, too.
        if (value !== state.base[prop]) return value
        // Store drafts on the copy (when one exists).
        drafts = state.copy
    }

    return (drafts[prop] = createDraft(value, state))
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
    // The `undefined` check is a fast path for pre-existing keys.
    if (state.base[prop] !== undefined || prop in state.base) {
        state.assigned[prop] = false
        markChanged(state)
    }
    if (state.copy) delete state.copy[prop]
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

function markChanged(state) {
    if (!state.modified) {
        state.modified = true
        state.copy = assign(shallowCopy(state.base), state.drafts)
        state.drafts = null
        if (state.parent) markChanged(state.parent)
    }
}
