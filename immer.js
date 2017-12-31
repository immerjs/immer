/**
 * @typedef {Object} RevocableProxy
 * @property {any} proxy
 * @property {Function} revoke
 */

// @ts-check

const isProxySymbol = Symbol("immer-proxy")

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
            if (prop === isProxySymbol) return target
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
                copy[prop] = isProxy(newValue) ? newValue[isProxySymbol] : newValue
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
        if (!copy) {
            copy = Array.isArray(base) ? base.slice() : Object.assign({}, base)
            copies.set(base, copy)
        }
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
            if (revocableProxies.has(base)) return revocableProxies.get(base).proxy
            //const proxy = new Proxy(base, objectTraps)
            const revocableProxy = Proxy.revocable(base, objectTraps)
            revocableProxies.set(base, revocableProxy)
            return revocableProxy.proxy
        }
        return base
    }

    // checks if the given base object has modifications, either because it is modified, or
    // because one of it's children is
    function hasChanges(base) {
        const proxy = revocableProxies.get(base)
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
        const copy = getOrCreateCopy(thing)
        Object.keys(copy).forEach(prop => {
            copy[prop] = finalize(copy[prop])
        })
        return copy
    }

    function finalizeArray(thing) {
        if (!hasChanges(thing)) return thing
        const copy = getOrCreateCopy(thing)
        copy.forEach((value, index) => {
            copy[index] = finalize(copy[index])
        })
        return copy
    }

    // create proxy for root
    const rootClone = createProxy(baseState)
    // execute the thunk
    thunk(rootClone)
    // revoke all proxies
    revoke(revocableProxies)
    // and finalize the modified proxy
    return finalize(baseState)
}

/**
 * Revoke all the proxies stored in the revocableProxies map
 * 
 * @param {Map<Object,RevocableProxy>} revocableProxies
 */
function revoke (revocableProxies){
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
    return !!value && !!value[isProxySymbol]
}

module.exports = immer
