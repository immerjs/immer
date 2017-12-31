"use strict"
// @ts-check

const IMMER_PROXY = Symbol("immer-proxy") // TODO: create per closure, to avoid sharing proxies between multiple immer version

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
    // Maps baseState objects to proxies
    const proxies = new Map()
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
                copy[prop] = isProxy(newValue) ? newValue[IMMER_PROXY] : newValue
            }
            return true
        },
        deleteProperty(target, property) {
            const copy = getOrCreateCopy(target)
            delete copy[property]
            return true
        }
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
        if (isPlainObject(base) || Array.isArray(base)) {
            if (isProxy(base)) return base // avoid double wrapping
            if (proxies.has(base)) return proxies.get(base)
            let proxyTarget = base
            // special case, if the base tree is frozen, we cannot modify it's proxy it in strict mode, clone first.
            if (Object.isFrozen(proxyTarget)) {
                proxyTarget = Array.isArray(proxyTarget) ? proxyTarget.slice() : { ...proxyTarget }
                Object.defineProperty(proxyTarget, CLONE_TARGET, {
                    enumerable: false,
                    value: base,
                    configurable: true
                })
            }
            // create the proxy
            const proxy = new Proxy(proxyTarget, objectTraps)
            proxies.set(base, proxy)
            return proxy
        }
        return base
    }

    // checks if the given base object has modifications, either because it is modified, or
    // because one of it's children is
    function hasChanges(base) {
        const proxy = proxies.get(base)
        if (!proxy) return false // nobody did read this object
        if (copies.has(base)) return true // a copy was created, so there are changes
        // look deeper
        const keys = Object.keys(base)
        for (let i = 0; i < keys.length; i++) {
            const value = base[keys[i]]
            if ((Array.isArray(value) || isPlainObject(value)) && hasChanges(value)) return true
        }
        return false
    }

    // given a base object, returns it if unmodified, or return the changed cloned if modified
    function finalize(base) {
        if (isPlainObject(base)) return finalizeObject(base)
        if (Array.isArray(base)) return finalizeArray(base)
        return base
    }

    function finalizeObject(thing) {
        if (!hasChanges(thing)) return thing
        const copy = getOrCreateCopy(thing) // TODO: getOrCreate is weird here..
        Object.keys(copy).forEach(prop => {
            copy[prop] = finalize(copy[prop])
        })
        delete copy[CLONE_TARGET]
        return freeze(copy)
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
    thunk(rootClone)
    // and finalize the modified proxy
    return finalize(baseState)
}

function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false
    const proto = Object.getPrototypeOf(value)
    return proto === Object.prototype || proto === null
}

function isProxy(value) {
    return !!value && !!value[IMMER_PROXY]
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
 */
function setAutoFreeze(enableAutoFreeze) {
    autoFreeze = enableAutoFreeze
}

module.exports.__esModule = true
module.exports.default = immer
module.exports.setAutoFreeze = setAutoFreeze
