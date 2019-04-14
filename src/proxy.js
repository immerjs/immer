"use strict"
import {
    assign,
    each,
    has,
    is,
    isDraftable,
    isDraft,
    isMap,
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

    let proxyTarget = state
    let traps = objectTraps
    if (Array.isArray(base)) {
        proxyTarget = [state]
        traps = arrayTraps
    } else if (isMap(base)) {
        traps = mapTraps
    }

    const {revoke, proxy} = Proxy.revocable(proxyTarget, traps)

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

const mapTraps = {
    get(state, prop, receiver) {
        if (prop === DRAFT_STATE) return state
        if (prop === "size") return source(state)[prop]
        if (prop === "has") {
            const stateCurrent = source(state)
            return stateCurrent[prop].bind(stateCurrent)
        }
        if (prop === "set") {
            return function(key, value) {
                markChanged(state)
                state.assigned[key] = true
                return state.copy.set(key, value)
            }
        }
        if (prop === "delete") {
            return function(key) {
                markChanged(state)
                state.assigned[key] = false
                return state.copy.delete(key)
            }
        }
        if (prop === "clear") {
            return function() {
                markChanged(state)
                state.assigned = {}
                for (const key of source(state).keys()) {
                    state.assigned[key] = false
                }
                return state.copy.clear()
            }
        }
        if (prop === "forEach") {
            return function(cb) {
                return source(state).forEach((_, key, map) => {
                    const value = receiver.get(key)
                    cb(value, key, map)
                }, this)
            }
        }
        if (prop === "get") {
            return function(key) {
                if (!state.modified && has(state.drafts, key)) {
                    return state.drafts[key]
                }
                if (state.modified && state.copy.has(key)) {
                    return state.copy.get(key)
                }

                const value = source(state).get(key)

                if (state.finalized || !isDraftable(value)) {
                    return value
                }

                const valueProxied = createProxy(value, state)
                if (!state.modified) {
                    state.drafts[key] = valueProxied
                } else {
                    state.copy.set(key, valueProxied)
                }
                return valueProxied
            }
        }
        if (
            prop === Symbol.iterator ||
            prop === "entries" ||
            prop === "values"
        ) {
            let getYieldable = (key, value) => [key, value]
            if (prop === "values") {
                getYieldable = (key, value) => value
            }
            return function*() {
                const iterator = source(state)[Symbol.iterator]()
                let result = iterator.next()
                while (!result.done) {
                    const [key] = result.value
                    const value = receiver.get(key)
                    yield getYieldable(key, value)
                    result = iterator.next()
                }
            }
        }
        if (prop === "keys") {
            return function*() {
                const iterator = source(state).keys()
                let result = iterator.next()
                while (!result.done) {
                    const key = result.value
                    yield key
                    result = iterator.next()
                }
            }
        }

        return Reflect.get(state, prop, receiver)
    }
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
