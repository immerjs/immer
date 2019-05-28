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
    if (isMap(value) || isSet(value)) return true
    return !!value[DRAFTABLE] || !!value.constructor[DRAFTABLE]
}

export function original(value) {
    if (value && value[DRAFT_STATE]) {
        return value[DRAFT_STATE].base
    }
    // otherwise return undefined
}

// We use Maps as `drafts` for Sets, not Objects
// See proxy.js
export function assignSet(target, override) {
    override.forEach(value => {
        // When we add new drafts we have to remove their originals if present
        const prev = original(value)
        if (prev) target.delete(prev)
        target.add(value)
    })
    return target
}

// We use Maps as `drafts` for Maps, not Objects
// See proxy.js
export function assignMap(target, override) {
    override.forEach((value, key) => target.set(key, value))
    return target
}

export const assign =
    Object.assign ||
    ((target, ...overrides) => {
        overrides.forEach(override =>
            Object.keys(override).forEach(key => (target[key] = override[key]))
        )
        return target
    })

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

export function each(obj, iter) {
    if (Array.isArray(obj) || isMap(obj) || isSet(obj)) {
        obj.forEach((entry, index) => iter(index, entry, obj))
    } else {
        ownKeys(obj).forEach(key => iter(key, obj[key], obj))
    }
}

export function isEnumerable(base, prop) {
    const desc = Object.getOwnPropertyDescriptor(base, prop)
    return !!desc && desc.enumerable
}

export function has(thing, prop) {
    return isMap(thing)
        ? thing.has(prop)
        : Object.prototype.hasOwnProperty.call(thing, prop)
}

export function get(thing, prop) {
    return isMap(thing) ? thing.get(prop) : thing[prop]
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
