export const NOTHING =
    typeof Symbol !== "undefined"
        ? Symbol("immer-nothing")
        : {["immer-nothing"]: true}

export const DRAFTABLE =
    typeof Symbol !== "undefined" && Symbol.for
        ? Symbol.for("immer-draftable")
        : "__$immer_draftable"

export const DRAFT_STATE =
    typeof Symbol !== "undefined" && Symbol.for
        ? Symbol.for("immer-state")
        : "__$immer_state"

export function isDraft(value) {
    return !!value && !!value[DRAFT_STATE]
}

export function isDraftable(value) {
    if (!value || typeof value !== "object") return false
    if (Array.isArray(value)) return true
    const proto = Object.getPrototypeOf(value)
    if (!proto || proto === Object.prototype) return true
    return !!value[DRAFTABLE] || !!value.constructor[DRAFTABLE]
}

export function original(value) {
    if (value && value[DRAFT_STATE]) {
        return value[DRAFT_STATE].base
    }
    // otherwise return undefined
}

export const assign =
    Object.assign ||
    function assign(target, value) {
        for (let key in value) {
            if (has(value, key)) {
                target[key] = value[key]
            }
        }
        return target
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
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) cb(i, value[i], value)
    } else {
        ownKeys(value).forEach(key => cb(key, value[key], value))
    }
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
