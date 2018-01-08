"use strict"
// @ts-check

const PROXY_TARGET = Symbol("immer-proxy")
const CHANGED_STATE = Symbol("immer-changed-state")
const PARENT = Symbol("immer-parent")

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
    const proxies = []

    // creates a proxy for plain objects / arrays
    function createProxy(base, parent) {
        let proxy
        if (isPlainObject(base)) proxy = createObjectProxy(base)
        else if (Array.isArray(base)) proxy = createArrayProxy(base)
        else throw new Error("Expected a plain object or array")
        createHiddenProperty(proxy, PROXY_TARGET, base)
        createHiddenProperty(proxy, CHANGED_STATE, false)
        createHiddenProperty(proxy, PARENT, parent)
        proxies.push(proxy)
        return proxy
    }

    function assertUnfinished() {
        if (finished)
            throw new Error(
                "Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process?"
            )
    }

    function proxySet(proxy, prop, value) {
        // immer func not ended?
        assertUnfinished()
        // actually a change?
        if (Object.is(proxy[prop], value)) return
        // mark changed
        markDirty(proxy)
        // and stop proxying, we know this object has changed
        Object.defineProperty(proxy, prop, {
            enumerable: true,
            writable: true,
            configurable: true,
            value: value
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
                    const proxy = createProxy(value, this)
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
                        }
                    })
                    return proxy
                },
                set(value) {
                    proxySet(this, prop, value)
                }
            })
        )
    }

    function createObjectProxy(base) {
        const proxy = Object.assign({}, base)
        Object.keys(base).forEach(prop =>
            Object.defineProperty(proxy, prop, createPropertyProxy(prop))
        )
        return proxy
    }

    function createArrayProxy(base) {
        const proxy = new Array(base.length)
        for (let i = 0; i < base.length; i++)
            Object.defineProperty(proxy, "" + i, createPropertyProxy("" + i))
        return proxy
    }

    // this sounds very expensive, but actually it is not that extensive in practice
    // as it will only visit proxies, and only do key-based change detection for objects for
    // which it is not already know that they are changed (that is, only object for which no known key was changed)
    function markChanges() {
        // intentionally we process the proxies in reverse order;
        // ideally we start by processing leafs in the tree, because if a child has changed, we don't have to check the parent anymore
        // reverse order of proxy creation approximates this
        for (let i = proxies.length - 1; i >= 0; i--) {
            const proxy = proxies[i]
            if (
                proxy[CHANGED_STATE] === false &&
                ((isPlainObject(proxy) && hasObjectChanges(proxy)) ||
                    (Array.isArray(proxy) && hasArrayChanges(proxy)))
            ) {
                markDirty(proxy)
            }
        }
    }

    function hasObjectChanges(proxy) {
        const baseKeys = Object.keys(proxy[PROXY_TARGET])
        const keys = Object.keys(proxy)
        return !shallowEqual(baseKeys, keys)
    }

    function hasArrayChanges(proxy) {
        return proxy[PROXY_TARGET].length !== proxy.length
    }

    function finalize(proxy) {
        // given a base object, returns it if unmodified, or return the changed cloned if modified
        if (!isProxy(proxy)) return proxy
        if (!proxy[CHANGED_STATE]) return proxy[PROXY_TARGET] // return the original target
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
    const rootClone = createProxy(baseState, undefined)
    // execute the thunk
    const maybeVoidReturn = thunk(rootClone)
    //values either than undefined will trigger warning;
    !Object.is(maybeVoidReturn, undefined) &&
        console.warn(
            `Immer callback expects no return value. However ${typeof maybeVoidReturn} was returned`
        )
    // and finalize the modified proxy
    finalizing = true
    // find and mark all changes (for parts not done yet)
    markChanges()
    const res = finalize(rootClone)
    // make sure all proxies become unusable
    finished = true
    return res
}

function markDirty(proxy) {
    proxy[CHANGED_STATE] = true
    let parent = proxy
    while ((parent = parent[PARENT])) {
        if (parent[CHANGED_STATE] === true) return
        parent[CHANGED_STATE] = true
    }
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
        writable: true
    })
}

function shallowEqual(objA, objB) {
    //From: https://github.com/facebook/fbjs/blob/c69904a511b900266935168223063dd8772dfc40/packages/fbjs/src/core/shallowEqual.js
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
