"use strict"
// @ts-check

/**
 * @typedef {Object} RevocableProxy
 * @property {any} proxy
 * @property {Function} revoke
 */

// TODO: rename to PROXY_TARGET
const IMMER_PROXY = Symbol("immer-proxy") // TODO: create per closure, to avoid sharing proxies between multiple immer version

// This property indicates that the current object is cloned for another object,
// to make sure the proxy of a frozen object is writeable
const CLONE_TARGET = Symbol("immer-clone-target")
const CHANGED_STATE = Symbol("immer-changed-state")
const CHANGED_METHOD = Symbol("immer-changed")

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
    /**
     * Maps baseState objects to revocable proxies
     * @type {Map<Object,RevocableProxy>}
     */
    const revocableProxies = new Map()
    // Maps baseState objects to their copies

    const copies = new Map()

    const objectTraps = {
        get(target, prop) {
            if (prop === IMMER_PROXY) return target
            return createProxy(getCurrentSource(target)[prop])
        },
        has(target, prop) {
            return prop in getCurrentSource(target)
        },
        ownKeys(target) {
            return Reflect.ownKeys(getCurrentSource(target))
        },
        set(target, prop, value) {
            const current = createProxy(getCurrentSource(target)[prop])
            const newValue = createProxy(value)
            if (current !== newValue) {
                const copy = getOrCreateCopy(target)
                copy[prop] = isProxy(newValue)
                    ? newValue[IMMER_PROXY]
                    : newValue
            }
            return true
        },
        deleteProperty(target, property) {
            const copy = getOrCreateCopy(target)
            delete copy[property]
            return true
        },
    }

    // creates a copy for a base object if there ain't one
    function getOrCreateCopy(base) {
        let copy = copies.get(base)
        if (copy) return copy
        const cloneTarget = base[CLONE_TARGET]
        if (cloneTarget) {
            // base is a clone already (source was frozen), no need to create addtional copy
            copies.set(cloneTarget, base)
            return base
        }
        // create a fresh copy
        copy = Array.isArray(base) ? base.slice() : Object.assign({}, base)
        copies.set(base, copy)
        return copy
    }

    // returns the current source of truth for a base object
    function getCurrentSource(base) {
        const copy = copies.get(base)
        return copy || base
    }

    // creates a proxy for plain objects / arrays
    function createProxy(base) {
        if (isProxy(base)) return base
        if (isPlainObject(base)) return createObjectProxy(base)
        if (Array.isArray(base)) return createObjectProxy(base) // TODO: create Array proxy?
        return base
    }

    function createObjectProxy(base) {
        // TODO: optimize, reuse property accessors
        const proxy = {}
        createHiddenProperty(proxy, IMMER_PROXY, base)
        createHiddenProperty(proxy, CHANGED_STATE, false)
        createHiddenProperty(proxy, CHANGED_METHOD, function() {
            if (this[CHANGED_STATE] === true) return true
            // TODO: first check child properties, that might be cheaper...
            return !shallowEqual(Object.keys(base), Object.keys(this))
        })
        Object.keys(base).forEach(prop => {
            Object.defineProperty(proxy, prop, {
                configurable: true,
                enumerable: true,
                get() {
                    // const target = this[PROXY_TARGET]
                    // return createProxy(getCurrentSource(target)[prop])
                    return createProxy(base[prop])
                },
                set(value) {
                    this[CHANGED_STATE] = true
                    Object.defineProperty(this, prop, {
                        enumerable: true,
                        writable: true,
                        configurable: true,
                        value: value,
                    })
                },
            })
        })
        revocableProxies.set(base, {
            proxy,
            revoke: () => {
                // TODO: set unreadable state, reuse closure
            },
        })
        return proxy
    }

    // checks if the given base object has modifications, either because it is modified, or
    // because one of it's children is
    function hasChanges(proxy) {
        if (!isProxy(proxy)) return false
        const base = proxy[IMMER_PROXY]
        if (proxy[CHANGED_METHOD](base)) return true // some property was modified
        // look deeper, this object was not modified, but maybe some of its children are
        const keys = Object.keys(base)
        for (let i = 0; i < keys.length; i++) {
            const value = proxy[keys[i]] // TODO: fix, this does convert value to a proxy?!
            if (
                (Array.isArray(value) || isPlainObject(value)) &&
                hasChanges(value)
            )
                return true
        }
        return false
    }

    // given a base object, returns it if unmodified, or return the changed cloned if modified
    function finalize(thing) {
        if (!isProxy(thing)) return thing
        if (isPlainObject(thing)) return finalizeObject(thing)
        if (Array.isArray(thing)) return finalizeArray(thing)
        return thing
    }

    function finalizeObject(proxy) {
        if (!hasChanges(proxy)) return proxy[IMMER_PROXY] // return the original target
        Object.keys(proxy).forEach(prop => {
            proxy[prop] = finalize(proxy[prop])
        })
        delete proxy[CLONE_TARGET]
        return freeze(proxy)
    }

    function finalizeArray(thing) {
        if (!hasChanges(thing)) return thing
        const copy = getOrCreateCopy(thing) // TODO: getOrCreate is weird here..
        copy.forEach((value, index) => {
            copy[index] = finalize(copy[index])
        })
        delete copy[CLONE_TARGET]
        return freeze(copy)
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
    // console.log(`proxies: ${revocableProxies.size}, copies: ${copies.size}`)
    // revoke all proxies
    revoke(revocableProxies)
    // and finalize the modified proxy
    return finalize(rootClone)
}

/**
 * Revoke all the proxies stored in the revocableProxies map
 *
 * @param {Map<Object,RevocableProxy>} revocableProxies
 */
function revoke(revocableProxies) {
    for (var revocableProxy of revocableProxies.values()) {
        revocableProxy.revoke()
    }
}

function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false
    const proto = Object.getPrototypeOf(value)
    return proto === Object.prototype || proto === null
}

function isProxy(value) {
    return !!(value && value[IMMER_PROXY])
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
    if (Object.is(objA, objB)) {
        return true
    }

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

    if (keysA.length !== keysB.length) {
        return false
    }

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
