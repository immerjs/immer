"use strict"
import {
    assign,
    each,
    has,
    is,
    isDraftable,
    isDraft,
    isMap,
    isSet,
    shallowCopy,
    DRAFT_STATE,
    assignMap,
    assignSet,
    original
} from "./common"
import {ImmerScope} from "./scope"

// Do nothing before being finalized.
export function willFinalize() {}

/**
 * Returns a new draft of the `base` object.
 *
 * The second argument is the parent draft-state (used internally).
 */
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
    } else if (isSet(base)) {
        traps = setTraps
        // We use values of a Set as keys and objects do not support other objects as keys
        state.drafts = new Map()
    }

    const {revoke, proxy} = Proxy.revocable(proxyTarget, traps)

    state.draft = proxy
    state.revoke = revoke

    scope.drafts.push(proxy)
    return proxy
}

/**
 * Object drafts
 */

const objectTraps = {
    get(state, prop) {
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
    },
    has(state, prop) {
        return prop in source(state)
    },
    ownKeys(state) {
        return Reflect.ownKeys(source(state))
    },
    set(state, prop, value) {
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
    },
    deleteProperty(state, prop) {
        // The `undefined` check is a fast path for pre-existing keys.
        if (peek(state.base, prop) !== undefined || prop in state.base) {
            state.assigned[prop] = false
            markChanged(state)
        }
        if (state.copy) delete state.copy[prop]
        return true
    },
    // Note: We never coerce `desc.value` into an Immer draft, because we can't make
    // the same guarantee in ES5 mode.
    getOwnPropertyDescriptor(state, prop) {
        const owner = source(state)
        const desc = Reflect.getOwnPropertyDescriptor(owner, prop)
        if (desc) {
            desc.writable = true
            desc.configurable = !Array.isArray(owner) || prop !== "length"
        }
        return desc
    },
    defineProperty() {
        throw new Error("Object.defineProperty() cannot be used on an Immer draft") // prettier-ignore
    },
    getPrototypeOf(state) {
        return Object.getPrototypeOf(state.base)
    },
    setPrototypeOf() {
        throw new Error("Object.setPrototypeOf() cannot be used on an Immer draft") // prettier-ignore
    }
}

/**
 * Array drafts
 */

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

/**
 * Map drafts
 */

const mapGetters = {
    [DRAFT_STATE]: state => state,
    size: state => source(state).size,
    has(state, prop) {
        state = source(state)
        return state.has.bind(state)
    },
    set: state => (key, value) => {
        const stateSource = source(state)
        if (!stateSource.has(key) || stateSource.get(key) !== value) {
            markChanged(state)
            state.assigned[key] = true
            state.copy.set(key, value)
        }
        return state.draft
    },
    delete: state => key => {
        markChanged(state)
        state.assigned[key] = false
        return state.copy.delete(key)
    },
    clear: state => () => {
        markChanged(state)
        state.assigned = {}
        for (const key of source(state).keys()) {
            state.assigned[key] = false
        }
        return state.copy.clear()
    },
    forEach: (state, _, receiver) => (cb, thisArg) =>
        source(state).forEach((_, key, map) => {
            const value = receiver.get(key)
            cb.call(thisArg, value, key, map)
        }),
    get: state => key => {
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

        const draft = createProxy(value, state)

        if (!state.modified) {
            state.drafts[key] = draft
        } else {
            state.copy.set(key, draft)
        }

        return draft
    },
    keys: state => () => source(state).keys(),
    values: iterateMapValues,
    entries: iterateMapValues,
    [Symbol.iterator]: iterateMapValues
}
const mapTraps = makeTrapsForGetters(mapGetters)

/** Map.prototype.values _-or-_ Map.prototype.entries */
function iterateMapValues(state, prop, receiver) {
    const getYieldable =
        prop === "values" ? (key, value) => value : (key, value) => [key, value]

    return () => {
        const iterator = source(state)[Symbol.iterator]()
        return makeIterable(() => {
            const result = iterator.next()
            if (!result.done) {
                const [key] = result.value
                const value = receiver.get(key)
                result.value = getYieldable(key, value)
            }
            return result
        })
    }
}

/**
 * Set drafts
 */

const setGetters = {
    [DRAFT_STATE]: state => state,
    size: state => source(state).size,
    has(state, prop) {
        state = source(state)
        return state.has.bind(state)
    },
    add: state => value => {
        if (!source(state).has(value)) {
            markChanged(state)
            state.copy.add(value)
        }
        return state.draft
    },
    delete: state => value => {
        markChanged(state)
        return state.copy.delete(value)
    },
    clear: state => () => {
        markChanged(state)
        return state.copy.clear()
    },
    forEach: state => (cb, thisArg) => {
        const iterator = iterateSetValues(state)()
        let result = iterator.next()
        while (!result.done) {
            cb.call(thisArg, result.value, result.value, state.draft)
            result = iterator.next()
        }
    },
    keys: iterateSetValues,
    values: iterateSetValues,
    entries: iterateSetValues,
    [Symbol.iterator]: iterateSetValues
}
const setTraps = makeTrapsForGetters(setGetters)

function iterateSetValues(state, prop) {
    return () => {
        const iterator = source(state)[Symbol.iterator]()

        return makeIterable(() => {
            const result = iterator.next()
            if (!result.done) {
                const valueWrapped = wrapSetValue(state, result.value)
                result.value = valueWrapped
                if (prop === "entries") {
                    result.value = [valueWrapped, valueWrapped]
                }
            }
            return result
        })
    }
}

function wrapSetValue(state, value) {
    const key = original(value) || value
    let draft = state.drafts.get(key)
    if (!draft) {
        if (state.finalized || !isDraftable(value)) {
            return value
        }
        draft = createProxy(value, state)
        state.drafts.set(key, draft)
        if (state.modified) {
            state.copy.add(draft)
        }
    }
    return draft
}

/**
 * Helpers
 */

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

function markChanged(state) {
    let resetDrafts = true
    let assignFn = assign
    if (isMap(state.base)) {
        assignFn = assignMap
    } else if (isSet(state.base)) {
        assignFn = assignSet
        // We need to keep track of how non-proxied objects are related to proxied ones.
        // For other data structures that support keys we can use those keys to access the item, notwithstanding it being a proxy or not.
        // Sets, however, do not have keys.
        // We use original objects as keys and keep proxified values as values.
        resetDrafts = false
    }
    if (!state.modified) {
        state.modified = true
        state.copy = assignFn(shallowCopy(state.base), state.drafts)
        if (resetDrafts) {
            state.drafts = null
        }
        if (state.parent) markChanged(state.parent)
    }
}

function makeIterable(next) {
    let self
    return (self = {
        [Symbol.iterator]: () => self,
        next
    })
}

function makeTrapsForGetters(getters) {
    return {
        get(state, prop, receiver) {
            return getters.hasOwnProperty(prop)
                ? getters[prop](state, prop, receiver)
                : Reflect.get(state, prop, receiver)
        },
        ownKeys(state) {
            return Reflect.ownKeys(source(state))
        },
        set(state, ...args) {
            return Reflect.set(source(state), ...args)
        },
        has(state, ...args) {
            return Reflect.has(source(state), ...args)
        },
        deleteProperty(state, ...args) {
            return Reflect.deleteProperty(source(state), ...args)
        },
        defineProperty(state, ...args) {
            return Reflect.defineProperty(source(state), ...args)
        },
        getOwnPropertyDescriptor(state, ...args) {
            return Reflect.getOwnPropertyDescriptor(source(state), ...args)
        },
        preventExtensions(state) {
            return Reflect.preventExtensions(source(state))
        },
        isExtensible(state) {
            return Reflect.isExtensible(source(state))
        },
        getPrototypeOf(state) {
            return Reflect.getPrototypeOf(source(state))
        },
        setPrototypeOf(state) {
            throw new Error("Object.setPrototypeOf() cannot be used on an Immer draft") // prettier-ignore
        }
    }
}
