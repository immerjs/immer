// @ts-check

const sourceSymbol = Symbol()

/**
 * Immer takes a state, and runs a function agains it.
 * That function can freely mutate the state, as it will create copies-on-write.
 * This means that the original state will stay unchanged, and once the function finishes, the modified state is returned
 *
 * @export
 * @param {any} baseState - the state to start with
 * @param {Function} thunk - function that receives a proxy of the base state as first argument and which can be freely modified
 * @returns {any} a new state, or the base state if nothing was modified
 */
function immer(baseState, thunk) {
    const proxies = new Map()
    const copies = new Map()

    const objectTraps = {
        get(target, prop) {
            if (prop === sourceSymbol) return target
            return proxyThing(getCurrentSource(target)[prop])
        },
        has(target, prop) {
            return prop in getCurrentSource(target)
        },
        ownKeys(target) {
            return Reflect.ownKeys(getCurrentSource(target))
        },
        set(target, prop, value) {
            const current = proxyThing(getCurrentSource(target)[prop])
            const newValue = proxyThing(value)
            if (current !== newValue) {
                const copy = getOrCreateCopy(target)
                copy[prop] = newValue
            }
            return true
        },
        deleteProperty(target, property) {
            const copy = getOrCreateCopy(target)
            delete copy[property]
            return true
        }
    }

    function getOrCreateCopy(object) {
        let copy = copies.get(object)
        if (!copy) {
            copy = Array.isArray(object) ? object.slice() : Object.assign({}, object)
            copies.set(object, copy)
        }
        return copy
    }

    function getCurrentSource(object) {
        const copy = copies.get(object)
        return copy || object
    }

    function proxyThing(thing) {
        if (isPlainObject(thing) || Array.isArray(thing)) return proxyObject(thing)
        return thing
    }

    function proxyObject(object) {
        if (proxies.has(object)) return proxies.get(object)

        const proxy = new Proxy(object, objectTraps)
        proxies.set(object, proxy)
        return proxy
    }

    function finalizeThing(thing) {
        if (isPlainObject(thing)) return finalizeObject(thing)
        if (Array.isArray(thing)) return finalizeArray(thing)
        return thing
    }

    function hasObjectChanges(thing) {
        const proxy = proxies.get(thing)
        if (!proxy) return false // nobody did read this object
        const base = proxy[sourceSymbol]
        if (copies.has(base)) return true // a copy was created, so there are changes
        // look deeper
        const keys = Object.keys(base)
        for (let i = 0; i < keys.length; i++) {
            if (hasObjectChanges(base[keys[i]])) return true
        }
        return false
    }

    function finalizeObject(thing) {
        if (!hasObjectChanges(thing)) return thing
        const copy = getOrCreateCopy(thing)
        Object.keys(copy).forEach(prop => {
            copy[prop] = finalizeThing(copy[prop])
        })
        return copy
    }

    function finalizeArray(thing) {
        if (!hasObjectChanges(thing)) return thing
        const copy = getOrCreateCopy(thing)
        copy.forEach((value, index) => {
            copy[index] = finalizeThing(copy[index])
        })
        return copy
    }

    const rootClone = proxyThing(baseState)
    thunk(rootClone)
    return finalizeThing(baseState)
}

function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false
    const proto = Object.getPrototypeOf(value)
    return proto === Object.prototype || proto === null
}

module.exports = immer
