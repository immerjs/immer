"use strict"
// @ts-check

if (typeof Proxy === "undefined")
    throw new Error(
        "Immer requires `Proxy` to be available, but it seems to be not available on your platform. Consider requiring immer '\"immer/es5\"' instead."
    )

/**
 * @typedef {Object} RevocableProxy
 * @property {any} proxy
 * @property {Function} revoke
 */

const IS_PROXY = Symbol("immer-proxy") // TODO: create per closure, to avoid sharing proxies between multiple immer version
const PROXY_STATE = Symbol("immer-proxy-state") // TODO: create per closure, to avoid sharing proxies between multiple immer version

// This property indicates that the current object is cloned for another object,
// to make sure the proxy of a frozen object is writeable
const CLONE_TARGET = Symbol("immer-clone-target")

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
    class State {
        // /** @type {boolean} */
        // modified
        // /** @type {State} */
        // parent
        // /** @type {any} */
        // base
        // /** @type {any} */
        // copy
        // /** @type {any} */
        // proxies

        constructor(parent, base) {
            this.modified
            this.parent = parent
            this.base = base
            this.proxies = {}
        }

        get source() {
            return this.modified === true ? this.copy : this.base
        }

        get(prop) {
            const proxy = this.proxies[prop]
            if (proxy) return proxy
            const value = this.source[prop]
            if (!isProxy(value) && isProxyable(value))
                return (this.proxies[prop] = createProxy(this, value))
            return value
        }

        set(prop, value) {
            if (!this.modified) {
                if (this.proxies[prop] === value || this.base[prop] === value)
                    return
                this.markChanged()
            }
            if (isProxy(value)) this.proxies[prop] = value
            this.copy[prop] = value
        }

        markChanged() {
            if (!this.modified) {
                this.modified = true
                this.copy = Array.isArray(this.base)
                    ? this.base.slice()
                    : Object.assign({}, this.base)
                if (this.parent) this.parent.markChanged()
            }
        }
    }

    const objectTraps = {
        get(target, prop) {
            if (prop === IS_PROXY) return true
            if (prop === PROXY_STATE) return target
            return target.get(prop)
        },
        has(target, prop) {
            return prop in target.source
        },
        ownKeys(target) {
            return Reflect.ownKeys(target.source)
        },
        set(target, prop, value) {
            target.set(prop, value)
            return true
        },
        deleteProperty(target, property) {
            target.markChanged()
            delete target.copy[property]
            return true
        },
        getOwnPropertyDescriptor(target, prop) {
            return Reflect.getOwnPropertyDescriptor(target.source, prop)
        },
        defineProperty(target, property, descriptor) {
            target.markChanged()
            Object.defineProperty(target.copy, property, descriptor)
            return true
        },
        setPrototypeOf() {
            throw new Error("Don't even try this...")
        }
    }

    const arrayTraps = {
        get(target, prop) {
            if (prop === IS_PROXY) return true
            if (prop === PROXY_STATE) return target[0]
            return target[0].get(prop)
        },
        has(target, prop) {
            return prop in target[0].source
        },
        ownKeys(target) {
            return Reflect.ownKeys(target[0].source)
        },
        set(target, prop, value) {
            target[0].set(prop, value)
            return true
        },
        deleteProperty(target, property) {
            target[0].markChanged()
            delete target[0].copy[property]
            return true
        },
        getOwnPropertyDescriptor(target, prop) {
            return Reflect.getOwnPropertyDescriptor(target[0].source, prop)
        },
        defineProperty(target, property, descriptor) {
            target[0].markChanged()
            Object.defineProperty(target[0].copy, property, descriptor)
            return true
        },
        setPrototypeOf() {
            throw new Error("Don't even try this...")
        }
    }

    // creates a proxy for plain objects / arrays
    function createProxy(parentState, base) {
        const state = new State(parentState, base)
        if (Array.isArray(base)) {
            // Proxy should be created with an array to make it an array for JS
            // so... here you have it!
            return new Proxy([state], arrayTraps)
        } else {
            return new Proxy(state, objectTraps)
        }
    }

    // given a base object, returns it if unmodified, or return the changed cloned if modified
    function finalize(base) {
        if (isProxy(base)) {
            const state = base[PROXY_STATE]
            if (state.modified === true) {
                if (isPlainObject(base)) return finalizeObject(state)
                if (Array.isArray(base)) return finalizeArray(state)
            } else return state.base
        }
        return base
    }

    function finalizeObject(state) {
        const copy = state.copy
        Object.keys(copy).forEach(prop => {
            copy[prop] = finalize(copy[prop])
        })
        return freeze(copy)
    }

    function finalizeArray(thing) {
        const copy = state.copy
        copy.forEach((value, index) => {
            copy[index] = finalize(copy[index])
        })
        return freeze(copy)
    }

    // create proxy for root
    const rootClone = createProxy(undefined, baseState)
    // execute the thunk
    const maybeVoidReturn = thunk(rootClone)
    //values either than undefined will trigger warning;
    !Object.is(maybeVoidReturn, undefined) &&
        console.warn(
            `Immer callback expects no return value. However ${typeof maybeVoidReturn} was returned`
        )
    // console.log(`proxies: ${revocableProxies.size}, copies: ${copies.size}`)
    // revoke all proxies
    // TODO: revoke(revocableProxies)
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
    return !!value && !!value[IS_PROXY]
}

function isProxyable(value) {
    if (!value) return false
    if (typeof value !== "object") return false
    return Array.isArray(value) || isPlainObject(value)
}

function freeze(value) {
    if (autoFreeze) {
        Object.freeze(value)
    }
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
function setAutoFreeze(enableAutoFreeze) {
    autoFreeze = enableAutoFreeze
}

Object.defineProperty(exports, "__esModule", {
    value: true
})
module.exports.default = immer
module.exports.setAutoFreeze = setAutoFreeze
