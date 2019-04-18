export const NOTHING =
    typeof Symbol !== "undefined"
        ? Symbol("immer-nothing")
        : {["immer-nothing"]: true}

export const DRAFTABLE =
    typeof Symbol !== "undefined"
        ? Symbol.for("immer-draftable")
        : "__$immer_draftable"

export const DRAFT_STATE =
    typeof Symbol !== "undefined" ? Symbol.for("immer-state") : "__$immer_state"

export function isDraft(value) {
    return !!value && !!value[DRAFT_STATE]
}

export function isDraftable(value) {
    if (!value || typeof value !== "object") return false
    if (Array.isArray(value)) return true
    const proto = Object.getPrototypeOf(value)
    if (!proto || proto === Object.prototype) return true
    if (isMap(value)) return true
    if (isSet(value)) return true
    return !!value[DRAFTABLE] || !!value.constructor[DRAFTABLE]
}

export function original(value) {
    if (value && value[DRAFT_STATE]) {
        return value[DRAFT_STATE].base
    }
    // otherwise return undefined
}

function assignSet(target, overrides) {
    overrides.forEach(override => {
        for (let key in override) {
            if (has(override, key)) {
                const value = override[key]
                target.add(value)
                // When we add nested drafts we have to remove their originals if present
                if (typeof value === "object" && value[DRAFT_STATE]) {
                    target.delete(value[DRAFT_STATE].base)
                }
            }
        }
    })
    return target
}
function assignMap(target, overrides) {
    overrides.forEach(override => {
        for (let key in override) {
            if (has(override, key)) {
                target.set(key, override[key])
            }
        }
    })
    return target
}
function assignObjectLegacy(target, overrides) {
    overrides.forEach(function(override) {
        for (let key in override) {
            if (has(override, key)) {
                target[key] = override[key]
            }
        }
    })
    return target
}
export function assign(target, ...overrides) {
    if (isMap(target)) {
        return assignMap(target, overrides)
    }
    if (isSet(target)) {
        return assignSet(target, overrides)
    }
    if (Object.assign) {
        return Object.assign(target, ...overrides)
    }
    return assignObjectLegacy(target, overrides)
}

export const ownKeys =
    typeof Reflect !== "undefined" && Reflect.ownKeys
        ? Reflect.ownKeys
        : typeof Object.getOwnPropertySymbols !== "undefined"
        ? obj =>
              Object.getOwnPropertyNames(obj).concat(
                  Object.getOwnPropertySymbols(obj)
              )
        : Object.getOwnPropertyNames

export function shallowCopy(base, invokeGetters = false) {
    if (Array.isArray(base)) return base.slice()
    if (isMap(base)) return new Map(base)
    if (isSet(base)) return new Set(base)
    const clone = Object.create(Object.getPrototypeOf(base))
    ownKeys(base).forEach(key => {
        if (key === DRAFT_STATE) {
            return // Never copy over draft state.
        }
        const desc = Object.getOwnPropertyDescriptor(base, key)
        let {value} = desc
        if (desc.get) {
            if (!invokeGetters) {
                throw new Error("Immer drafts cannot have computed properties")
            }
            value = desc.get.call(base)
        }
        if (desc.enumerable) {
            clone[key] = value
        } else {
            Object.defineProperty(clone, key, {
                value,
                writable: true,
                configurable: true
            })
        }
    })
    return clone
}

export function each(value, cb) {
    if (Array.isArray(value) || isMap(value) || isSet(value)) {
        value.forEach((entry, index) => cb(index, entry, value))
        return
    }
    ownKeys(value).forEach(key => cb(key, value[key], value))
}

export function isEnumerable(base, prop) {
    const desc = Object.getOwnPropertyDescriptor(base, prop)
    return !!desc && desc.enumerable
}

export function has(thing, prop) {
    return Object.prototype.hasOwnProperty.call(thing, prop)
}

export function is(x, y) {
    // From: https://github.com/facebook/fbjs/blob/c69904a511b900266935168223063dd8772dfc40/packages/fbjs/src/core/shallowEqual.js
    if (x === y) {
        return x !== 0 || 1 / x === 1 / y
    } else {
        return x !== x && y !== y
    }
}

export function isMap(target) {
    return target instanceof Map
}

export function isSet(target) {
    return target instanceof Set
}
