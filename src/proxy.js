"use strict"
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
import {ImmerScope} from "./scope"

// Do nothing before being finalized.
export function willFinalize() {}

export function createProxy(base, parent) {
    const scope = parent ? parent.scope : ImmerScope.current
    const state = {
        // Track which produce call this is associated with.
        scope,
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
        ? // [state] is used for arrays, to make sure the proxy is array-ish and not violate invariants,
          // although state itself is an object
          Proxy.revocable([state], arrayTraps)
        : Proxy.revocable(state, objectTraps)

    state.draft = proxy
    state.revoke = revoke

    scope.drafts.push(proxy)
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

// returns the object we should be reading the current value from, which is base, until some change has been made
function source(state) {
    return state.copy || state.base
}

// Access a property without creating an Immer draft.
function peek(draft, prop) {
    const state = draft[DRAFT_STATE]
    const desc = Reflect.getOwnPropertyDescriptor(
        state ? source(state) : draft,
        prop
    )
    return desc && desc.value
}

function get(state, prop) {
    if (prop === DRAFT_STATE) return state
    let {drafts} = state

    // Check for existing draft in unmodified state.
    if (!state.modified && has(drafts, prop)) {
        return drafts[prop]
    }

    const value = source(state)[prop]
    if (state.finalized || !isDraftable(value)) {
        return value
    }

    // Check for existing draft in modified state.
    if (state.modified) {
        // Assigned values are never drafted. This catches any drafts we created, too.
        if (value !== peek(state.base, prop)) return value
        // Store drafts on the copy (when one exists).
        drafts = state.copy
    }

    return (drafts[prop] = createProxy(value, state))
}

function set(state, prop, value) {
    if (!state.modified) {
        const baseValue = peek(state.base, prop)
        // Optimize based on value's truthiness. Truthy values are guaranteed to
        // never be undefined, so we can avoid the `in` operator. Lastly, truthy
        // values may be drafts, but falsy values are never drafts.
        const isUnchanged = value
            ? is(baseValue, value) || value === state.drafts[prop]
            : is(baseValue, value) && prop in state.base
        if (isUnchanged) return true
        markChanged(state)
    }
    state.assigned[prop] = true
    state.copy[prop] = value
    return true
}

function deleteProperty(state, prop) {
    // The `undefined` check is a fast path for pre-existing keys.
    if (peek(state.base, prop) !== undefined || prop in state.base) {
        state.assigned[prop] = false
        markChanged(state)
    }
    if (state.copy) delete state.copy[prop]
    return true
}

// Note: We never coerce `desc.value` into an Immer draft, because we can't make
// the same guarantee in ES5 mode.
function getOwnPropertyDescriptor(state, prop) {
    const owner = source(state)
    const desc = Reflect.getOwnPropertyDescriptor(owner, prop)
    if (desc) {
        desc.writable = true
        desc.configurable = !Array.isArray(owner) || prop !== "length"
    }
    return desc
}

function markChanged(state) {
    if (!state.modified) {
        state.modified = true
        state.copy = assign(shallowCopy(state.base), state.drafts)
        state.drafts = null
        if (state.parent) markChanged(state.parent)
    }
}
