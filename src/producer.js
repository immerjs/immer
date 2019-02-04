import {produce, immerable} from "./index"

/**
 * Accepts a function, or a target and property name, and turns the designated function into
 * a curried producer, that always takes 'this' as the base state.
 * This is a create way to create immutable classes
 */
export function producer(target, prop, d) {
    // producer(fn)
    if (arguments.length === 1 && typeof target === "function") {
        return function producer(...args) {
            return produce(this, draft => {
                target.apply(draft, args)
            })
        }
    }
    // producer(prototype, "prop")
    // @producer fn
    const descriptor = d || Object.getOwnPropertyDescriptor(target, prop)
    if (!descriptor)
        throw new Error(
            `Property '${prop}' does not exist on the specified target (tip: make sure to pass 'Class.prototype', not just 'Class')`
        )
    const {value} = descriptor
    if (typeof value !== "function")
        throw new Error(
            `@producer should be used on methods only, got: ${typeof value}`
        )
    const newDescriptor = {
        ...descriptor,
        value: producer(value)
    }
    target[immerable] = true
    if (!d) Object.defineProperty(target, prop, newDescriptor)
    else return newDescriptor
}
