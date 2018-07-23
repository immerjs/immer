export {setAutoFreeze, setUseProxies, isMap, isSet} from "./common"

import {isProxyable, getUseProxies} from "./common"
import {produceProxy} from "./proxy"
import {produceEs5} from "./es5"

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
    // prettier-ignore
    if (arguments.length !== 1 && arguments.length !== 2) throw new Error("produce expects 1 or 2 arguments, got " + arguments.length)

    // curried invocation
    if (typeof baseState === "function") {
        // prettier-ignore
        if (typeof producer === "function") throw new Error("if first argument is a function (curried invocation), the second argument to produce cannot be a function")

        const initialState = producer
        const recipe = baseState

        return function() {
            const args = arguments

            const currentState =
                args[0] === undefined && initialState !== undefined
                    ? initialState
                    : args[0]

            return produce(currentState, draft => {
                args[0] = draft // blegh!
                return recipe.apply(draft, args)
            })
        }
    }

    // prettier-ignore
    {
        if (typeof producer !== "function") throw new Error("if first argument is not a function, the second argument to produce should be a function")
    }

    // if state is a primitive, don't bother proxying at all
    if (typeof baseState !== "object" || baseState === null) {
        const returnValue = producer(baseState)
        return returnValue === undefined ? baseState : returnValue
    }

    if (!isProxyable(baseState))
        throw new Error(
            `the first argument to an immer producer should be a primitive, plain object or array, got ${typeof baseState}: "${baseState}"`
        )
    return getUseProxies()
        ? produceProxy(baseState, producer)
        : produceEs5(baseState, producer)
}
