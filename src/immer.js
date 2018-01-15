"use strict"
// @ts-check

if (typeof Proxy === "undefined")
    throw new Error(
        "Immer requires `Proxy` to be available, but it seems to be not available on your platform. Consider requiring immer '\"immer/es5\"' instead."
    )

const PROXY_STATE = Symbol("immer-proxy-state")
let autoFreeze = true
let revocableProxies = null

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
for (let key in objectTraps) {
    arrayTraps[key] = function() {
        arguments[0] = arguments[0][0]
        return objectTraps[key].apply(this, arguments)
    }
}

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
            (prop in state.base && Object.is(state.base[prop], value)) ||
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
        state.copy = Array.isArray(state.base)
            ? state.base.slice()
            : Object.assign({}, state.base) // TODO: eliminate those isArray checks?
        Object.assign(state.copy, state.proxies) // yup that works for arrays as well
        if (state.parent) markChanged(state.parent)
    }
}

// creates a proxy for plain objects / arrays
function createProxy(parentState, base) {
    const state = createState(parentState, base)
    let proxy
    if (Array.isArray(base)) {
        proxy = Proxy.revocable([state], arrayTraps)
    } else {
        proxy = Proxy.revocable(state, objectTraps)
    }
    revocableProxies.push(proxy)
    return proxy.proxy
}

// given a base object, returns it if unmodified, or return the changed cloned if modified
function finalize(base) {
    if (isProxy(base)) {
        const state = base[PROXY_STATE]
        if (state.modified === true) {
            if (state.finalized === true) return state.copy
            state.finalized = true
            if (Array.isArray(state.base)) return finalizeArray(state)
            return finalizeObject(state)
        } else return state.base
    } else if (base !== null && typeof base === "object") {
        // If finalize is called on an object that was not a proxy, it means that it is an object that was not there in the original
        // tree and it could contain proxies at arbitrarily places. Let's find and finalize them as well
        // TODO: optimize this; walk the tree without writing to find proxies
        if (Array.isArray(base)) {
            for (let i = 0; i < base.length; i++) base[i] = finalize(base[i])
            return freeze(base)
        }
        const proto = Object.getPrototypeOf(base)
        if (proto === null || proto === Object.prototype) {
            for (let key in base) base[key] = finalize(base[key])
            return freeze(base)
        }
    }
    return base
}

function finalizeObject(state) {
    const copy = state.copy
    const base = state.base
    for (var prop in copy) {
        if (copy[prop] !== base[prop]) copy[prop] = finalize(copy[prop])
    }
    return freeze(copy)
}

function finalizeArray(state) {
    const copy = state.copy
    const base = state.base
    for (let i = 0; i < copy.length; i++) {
        if (copy[i] !== base[i]) copy[i] = finalize(copy[i])
    }
    return freeze(copy)
}

/**
 * produce takes a state, and runs a function against it.
 * That function can freely mutate the state, as it will create copies-on-write.
 * This means that the original state will stay unchanged, and once the function finishes, the modified state is returned
 *
 * @export
 * @param {any} baseState - the state to start with
 * @param {Function} producer - function that receives a proxy of the base state as first argument and which can be freely modified
 * @returns {any} a new state, or the base state if nothing was modified
 */
export default function produce(baseState, producer) {
    // curried invocation
    if (arguments.length === 1) {
        const producer = baseState
        // prettier-ignore
        if (typeof producer !== "function") throw new Error("if produce is called with 1 argument, the first argument should be a function")
        return function() {
            const args = arguments
            return produce(args[0], draft => {
                args[0] = draft // blegh!
                baseState.apply(null, args)
            })
        }
    }

    // prettier-ignore
    {
        if (arguments.length !== 2)  throw new Error("produce expects 1 or 2 arguments, got " + arguments.length)
        if (!isProxyable(baseState)) throw new Error("the first argument to produce should be a plain object or array, got " + (typeof baseState))
        if (typeof producer !== "function") throw new Error("the second argument to produce should be a function")
    }

    const previousProxies = revocableProxies
    revocableProxies = []
    try {
        // create proxy for root
        const rootClone = createProxy(undefined, baseState)
        // execute the thunk
        const maybeVoidReturn = producer(rootClone)
        //values either than undefined will trigger warning;
        !Object.is(maybeVoidReturn, undefined) &&
            console.warn(
                `Immer callback expects no return value. However ${typeof maybeVoidReturn} was returned`
            )
        // and finalize the modified proxy
        const res = finalize(rootClone)
        // revoke all proxies
        revocableProxies.forEach(p => p.revoke())
        return res
    } finally {
        revocableProxies = previousProxies
    }
}

function isProxy(value) {
    return !!value && !!value[PROXY_STATE]
}

function isProxyable(value) {
    if (!value) return false
    if (typeof value !== "object") return false
    if (Array.isArray(value)) return true
    const proto = Object.getPrototypeOf(value)
    return proto === null || proto === Object.prototype
}

function freeze(value) {
    // short circuit to achieve 100% code coverage instead of 98%
    /*
    if(autoFreeze) {
        Object.freeze(value)
    }
    * */
    autoFreeze && Object.freeze(value)
    return value
}

/**
 * Automatically freezes any state trees generated by immer.
 * This protects against accidental modifications of the state tree outside of an immer function.
 * This comes with a performance impact, so it is recommended to disable this option in production.
 * It is by default enabled.
 *
 * @returns {void}
 */
export function setAutoFreeze(enableAutoFreeze) {
    autoFreeze = enableAutoFreeze
}
