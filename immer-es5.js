import {isObject} from "util"
;("use strict")
// @ts-check

const PROXY_TARGET = Symbol("immer-proxy") // TODO: create per closure, to avoid sharing proxies between multiple immer version
const CHANGED_STATE = Symbol("immer-changed-state")

let autoFreeze = true

/**
 * Immer takes a state, and runs a function against it.
 * That function can freely mutate the state, as it will create copies-on-write.
 * This means that the original state will stay unchanged, and once the function finishes, the modified state is returned
 *
 * @export
 * @param {any} baseState - the state to start with
 * @param {Function} thunk - function that receives a proxy of the base state as first argument and which can be freely modified
 * @returns {any} a new state, or the base state if nothing was modified
 */
function immer(baseState, thunk) {
    let finalizing = false
    let finished = false
    const descriptors = {}

    // creates a proxy for plain objects / arrays
    function createProxy(base) {
        if (isPlainObject(base)) return createObjectProxy(base)
        if (Array.isArray(base)) return createArrayProxy(base)
        throw new Error("Expected a plain object or array")
    }

    function assertUnfinished() {
        if (finished)
            throw new Error(
                "Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process?",
            )
    }

    function proxySet(target, prop, value) {
        // immer func not ended?
        assertUnfinished()
        // actually a change?
        if (Object.is(target[prop], value)) return
        // mark changed
        target[CHANGED_STATE] = true
        // and stop proxying, we know this object has changed
        Object.defineProperty(target, prop, {
            enumerable: true,
            writable: true,
            configurable: true,
            value: value,
        })
    }

    function createPropertyProxy(prop) {
        return (
            descriptors[prop] ||
            (descriptors[prop] = {
                configurable: true,
                enumerable: true,
                get() {
                    assertUnfinished()
                    // find the target object
                    const target = this[PROXY_TARGET]
                    // find the original value
                    const value = target[prop]
                    // if we are finalizing, don't bother creating proxies, just return base value
                    if (finalizing) return value
                    // if not proxy-able, return value
                    if (!isPlainObject(value) && !Array.isArray(value))
                        return value
                    // otherwise, create proxy
                    const proxy = createProxy(value)
                    // and make sure this proxy is returned from this prop in the future if read
                    // (write behavior as is)
                    Object.defineProperty(this, prop, {
                        configurable: true,
                        enumerable: true,
                        get() {
                            return proxy
                        },
                        set(value) {
                            proxySet(this, prop, value)
                        },
                    })
                    return proxy
                },
                set(value) {
                    proxySet(this, prop, value)
                },
            })
        )
    }

    function createObjectProxy(base) {
        const proxy = {}
        createHiddenProperty(proxy, PROXY_TARGET, base)
        createHiddenProperty(proxy, CHANGED_STATE, false)
        Object.keys(base).forEach(prop =>
            Object.defineProperty(proxy, prop, createPropertyProxy(prop)),
        )
        return proxy
    }

    function createArrayProxy(base) {
        const proxy = []
        createHiddenProperty(proxy, PROXY_TARGET, base)
        createHiddenProperty(proxy, CHANGED_STATE, false)
        for (let i = 0; i < base.length; i++)
            Object.defineProperty(proxy, "" + i, createPropertyProxy("" + i))
        return proxy
    }

    function hasChanges(proxy) {
        if (!isProxy(proxy)) return false
        if (proxy[CHANGED_STATE]) return true // some property was modified
        if (isPlainObject(proxy)) return objectHasChanges(proxy)
        if (Array.isArray(proxy)) return arrayHasChanges(proxy)
    }

    function objectHasChanges(proxy) {
        const baseKeys = Object.keys(proxy[PROXY_TARGET])
        const keys = Object.keys(proxy)
        if (!shallowEqual(baseKeys, keys)) return true
        // look deeper, this object was not modified, but maybe some of its children are
        for (let i = 0; i < keys.length; i++) {
            if (hasChanges(proxy[keys[i]])) return true
        }
        return false
    }

    function arrayHasChanges(proxy) {
        const target = proxy[PROXY_TARGET]
        if (target.length !== proxy.length) return true
        // look deeper, this object was not modified, but maybe some of its children are
        for (let i = 0; i < proxy.length; i++) {
            if (hasChanges(proxy[i])) return true
        }
        return false
    }

    function finalize(proxy) {
        // given a base object, returns it if unmodified, or return the changed cloned if modified
        if (!isProxy(proxy)) return proxy
        if (!hasChanges(proxy)) return proxy[PROXY_TARGET] // return the original target
        if (isPlainObject(proxy)) return finalizeObject(proxy)
        if (Array.isArray(proxy)) return finalizeArray(proxy)
        throw new Error("Illegal state")
    }

    function finalizeObject(proxy) {
        const res = {}
        Object.keys(proxy).forEach(prop => {
            res[prop] = finalize(proxy[prop])
        })
        return freeze(res)
    }

    function finalizeArray(proxy) {
        return freeze(proxy.map(finalize))
    }

    // create proxy for root
    const rootClone = createProxy(baseState)
    // execute the thunk
    const maybeVoidReturn = thunk(rootClone)
    //values either than undefined will trigger warning;
    !Object.is(maybeVoidReturn, undefined) &&
        console.warn(
            `Immer callback expects no return value. However ${typeof maybeVoidReturn} was returned`,
        )
    // and finalize the modified proxy
    finalizing = true
    const res = finalize(rootClone)
    // make sure all proxies become unusable
    finished = true
    return res
}

function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false
    const proto = Object.getPrototypeOf(value)
    return proto === Object.prototype || proto === null
}

function isProxy(value) {
    return !!(value && value[PROXY_TARGET])
}

function freeze(value) {
    if (autoFreeze) {
        Object.freeze(value)
    }
    return value
}

function createHiddenProperty(target, prop, value) {
    Object.defineProperty(target, prop, {
        value: value,
        enumerable: false,
        writable: true,
    })
}

function shallowEqual(objA, objB) {
    if (Object.is(objA, objB)) return true
    if (
        typeof objA !== "object" ||
        objA === null ||
        typeof objB !== "object" ||
        objB === null
    ) {
        return false
    }
    const keysA = Object.keys(objA)
    const keysB = Object.keys(objB)
    if (keysA.length !== keysB.length) return false
    for (let i = 0; i < keysA.length; i++) {
        if (
            !hasOwnProperty.call(objB, keysA[i]) ||
            !Object.is(objA[keysA[i]], objB[keysA[i]])
        ) {
            return false
        }
    }
    return true
}

/**
 * Automatically freezes any state trees generated by immer.
 * This protects against accidental modifications of the state tree outside of an immer function.
 * This comes with a performance impact, so it is recommended to disable this option in production.
 * It is by default enabled.
 *
 * @returns {void}
 */
function setAutoFreeze(enableAutoFreeze) {
    autoFreeze = enableAutoFreeze
}

createHiddenProperty(exports, "__esModule", true)
module.exports.default = immer
module.exports.setAutoFreeze = setAutoFreeze
