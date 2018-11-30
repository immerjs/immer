export const NOTHING =
    typeof Symbol !== "undefined"
        ? Symbol("immer-nothing")
        : {["immer-nothing"]: true}

export const DRAFT_STATE =
    typeof Symbol !== "undefined" ? Symbol("immer-state") : "__$immer_state"

export function isDraft(value) {
    return !!value && !!value[DRAFT_STATE]
}

export function isDraftable(value) {
    if (!value) return false
    if (typeof value !== "object") return false
    if (Array.isArray(value)) return true
    const proto = Object.getPrototypeOf(value)
    return proto === null || proto === Object.prototype
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

export function shallowCopy(value) {
    if (Array.isArray(value)) return value.slice()
    const target = value.__proto__ === undefined ? Object.create(null) : {}
    return assign(target, value)
}

export function each(value, cb) {
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) cb(i, value[i], value)
    } else {
        for (let key in value) cb(key, value[key], value)
    }
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
