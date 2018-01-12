"use strict"
// @ts-check

if (typeof Proxy === "undefined")
    throw new Error(
        "Immer requires `Proxy` to be available, but it seems to be not available on your platform. Consider requiring immer '\"immer/es5\"' instead."
    )

const PROXY_STATE = Symbol("immer-proxy-state")
let autoFreeze = true

const objectTraps = {
    get(target, prop) {
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
    deleteProperty(target, prop) {
        target.deleteProp(prop)
        return true
    },
    getOwnPropertyDescriptor(target, prop) {
        return target.getOwnPropertyDescriptor(prop)
    },
    defineProperty(target, property, descriptor) {
        target.defineProperty(property, descriptor)
    },
    setPrototypeOf() {
        throw new Error("Don't even try this...")
    }
}

const arrayTraps = {
    get(target, prop) {
        if (prop === PROXY_STATE) return target[0]
        return target[0].get(prop)
    },
    has(target, prop) {
        return prop === PROXY_STATE || prop in target[0].source
    },
    ownKeys(target) {
        return Reflect.ownKeys(target[0].source)
    },
    set(target, prop, value) {
        target[0].set(prop, value)
        return true
    },
    deleteProperty(target, prop) {
        target[0].deleteProp(prop)
        return true
    },
    getOwnPropertyDescriptor(target, prop) {
        return target[0].getOwnPropertyDescriptor(prop)
    },
    defineProperty(target, property, descriptor) {
        target[0].defineProperty(property, descriptor)
    },
    setPrototypeOf() {
        throw new Error("Don't even try this...")
    }
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
    const revocableProxies = []

    class State {
        constructor(parent, base) {
            this.modified = false
            this.finalized = false
            this.parent = parent
            this.base = base
            this.copy = undefined
            this.proxies = {}
        }

        get source() {
            return this.modified === true ? this.copy : this.base
        }

        get(prop) {
            if (this.modified) {
                const value = this.copy[prop]
                if (!isProxy(value) && isProxyable(value))
                    return (this.copy[prop] = createProxy(this, value))
                return value
            } else {
                if (prop in this.proxies) return this.proxies[prop]
                const value = this.base[prop]
                if (!isProxy(value) && isProxyable(value))
                    return (this.proxies[prop] = createProxy(this, value))
                return value
            }
        }

        set(prop, value) {
            if (!this.modified) {
                if (
                    (prop in this.base && Object.is(this.base[prop], value)) ||
                    (prop in this.proxies && this.proxies[prop] === value)
                )
                    return
                this.markChanged()
            }
            this.copy[prop] = value
        }

        deleteProp(prop) {
            this.markChanged()
            delete this.copy[prop]
        }

        getOwnPropertyDescriptor(prop) {
            const owner = this.modified
                ? this.copy
                : prop in this.proxies ? this.proxies : this.base
            const descriptor = Reflect.getOwnPropertyDescriptor(owner, prop)
            if (descriptor && !(Array.isArray(owner) && prop === "length"))
                descriptor.configurable = true
            return descriptor
        }

        defineProperty(property, descriptor) {
            throw new Error(
                "Immer does currently not support defining properties on draft objects"
            )
        }

        markChanged() {
            if (!this.modified) {
                this.modified = true
                this.copy = Array.isArray(this.base)
                    ? this.base.slice()
                    : Object.assign({}, this.base) // TODO: eliminate those isArray checks?
                Object.assign(this.copy, this.proxies) // yup that works for arrays as well
                if (this.parent) this.parent.markChanged()
            }
        }
    }

    // creates a proxy for plain objects / arrays
    function createProxy(parentState, base) {
        const state = new State(parentState, base)
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
                for (let i = 0; i < base.length; i++)
                    base[i] = finalize(base[i])
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
