"use strict"
// @ts-check

const PROXY_STATE = Symbol("immer-proxy-state") // TODO: create per closure, to avoid sharing proxies between multiple immer version

let autoFreeze = true

/**
 * Immer takes a state, and runs a function against it.
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

    let finalizing = false
    let finished = false
    const descriptors = {}
    const states = []

    class State {
        constructor(parent, proxy, base) {
            this.modified = false
            this.hasCopy = false
            this.parent = parent
            this.base = base
            this.proxy = proxy
            this.copy = undefined
        }

        get source() {
            return this.hasCopy ? this.copy : this.base
        }

        get(prop) {
            assertUnfinished()
            const value = this.source[prop]
            if (!finalizing && !isProxy(value) && isProxyable(value)) {
                this.prepareCopy()
                return (this.copy[prop] = createProxy(this, value))
            }
            return value
        }

        set(prop, value) {
            assertUnfinished()
            if (!this.modified) {
                if (Object.is(this.source[prop], value)) return
                this.markChanged()
            }
            this.prepareCopy()
            this.copy[prop] = value
        }

        markChanged() {
            if (!this.modified) {
                this.modified = true
                if (this.parent) this.parent.markChanged()
            }
        }

        prepareCopy() {
            if (this.hasCopy) return
            this.hasCopy = true
            this.copy = Array.isArray(this.base)
                ? this.base.slice()
                : Object.assign({}, this.base)
        }
    }

    // creates a proxy for plain objects / arrays
    function createProxy(parent, base) {
        let proxy
        if (Array.isArray(base)) proxy = createArrayProxy(base)
        else proxy = createObjectProxy(base)
        const state = new State(parent, proxy, base)
        createHiddenProperty(proxy, PROXY_STATE, state)
        states.push(state)
        return proxy
    }

    function createPropertyProxy(prop) {
        return (
            descriptors[prop] ||
            (descriptors[prop] = {
                configurable: true,
                enumerable: true,
                get() {
                    return this[PROXY_STATE].get(prop)
                },
                set(value) {
                    this[PROXY_STATE].set(prop, value)
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

    function assertUnfinished() {
        if (finished)
            throw new Error(
                "Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process?"
            )
    }

    // this sounds very expensive, but actually it is not that extensive in practice
    // as it will only visit proxies, and only do key-based change detection for objects for
    // which it is not already know that they are changed (that is, only object for which no known key was changed)
    function markChanges() {
        // intentionally we process the proxies in reverse order;
        // ideally we start by processing leafs in the tree, because if a child has changed, we don't have to check the parent anymore
        // reverse order of proxy creation approximates this
        for (let i = states.length - 1; i >= 0; i--) {
            const state = states[i]
            if (state.modified === false) {
                if (Array.isArray(state.base)) {
                    if (hasArrayChanges(state)) state.markChanged()
                } else if (hasObjectChanges(state)) state.markChanged()
            }
        }
    }

    function hasObjectChanges(state) {
        const baseKeys = Object.keys(state.base)
        const keys = Object.keys(state.proxy)
        return !shallowEqual(baseKeys, keys)
    }

    function hasArrayChanges(state) {
        return state.proxy.length !== state.base.length
    }

    function finalize(proxy) {
        // TODO: almost litterally same as Proxy impl; let's reduce code duplication and rollup
        if (isProxy(proxy)) {
            const state = proxy[PROXY_STATE]
            if (state.modified === true) {
                if (Array.isArray(state.base))
                    return finalizeArray(proxy, state)
                return finalizeObject(proxy, state)
            } else return state.base
        } else if (proxy !== null && typeof proxy === "object") {
            // If finalize is called on an object that was not a proxy, it means that it is an object that was not there in the original
            // tree and it could contain proxies at arbitrarily places. Let's find and finalize them as well
            if (Array.isArray(proxy)) {
                for (let i = 0; i < proxy.length; i++)
                    proxy[i] = finalize(proxy[i])
                return freeze(proxy)
            }
            const proto = Object.getPrototypeOf(proxy)
            if (proto === null || proto === Object.prototype) {
                for (let key in proxy) proxy[key] = finalize(proxy[key])
                return freeze(proxy)
            }
        }
        return proxy
    }

    function finalizeObject(proxy, state) {
        const res = Object.assign({}, proxy)
        const base = state.base
        for (let prop in res) {
            if (proxy[prop] !== base[prop]) res[prop] = finalize(res[prop])
        }
        return freeze(res)
    }

    function finalizeArray(proxy, state) {
        const res = proxy.slice()
        const base = state.base
        for (let i = 0; i < res.length; i++) {
            if (res[i] !== base[i]) res[i] = finalize(res[i])
        }
        return freeze(res)
    }

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
    finalizing = true
    // find and mark all changes (for parts not done yet)
    markChanges()
    const res = finalize(rootClone)
    // make sure all proxies become unusable
    finished = true
    return res
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
export function setAutoFreeze(enableAutoFreeze) {
    autoFreeze = enableAutoFreeze
}
