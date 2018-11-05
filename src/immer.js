export {setAutoFreeze, setUseProxies, original} from "./common"

import {applyPatches as applyPatchesImpl} from "./patches"
import {isProxyable, getUseProxies, NOTHING} from "./common"
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
 * @param {Function} patchListener - optional function that will be called with all the patches produced here
 * @returns {any} a new state, or the base state if nothing was modified
 */
export function produce(baseState, producer, patchListener) {
    // prettier-ignore
    if (arguments.length < 1 || arguments.length > 3) throw new Error("produce expects 1 to 3 arguments, got " + arguments.length)

    // curried invocation
    if (typeof baseState === "function") {
        // prettier-ignore
        if (typeof producer === "function") throw new Error("if first argument is a function (curried invocation), the second argument to produce cannot be a function")

        const initialState = producer
        const recipe = baseState

        return function(currentState = initialState, ...args) {
            return produce(currentState, draft =>
                recipe.call(draft, draft, ...args)
            )
        }
    }

    // prettier-ignore
    {
        if (typeof producer !== "function") throw new Error("if first argument is not a function, the second argument to produce should be a function")
        if (patchListener !== undefined && typeof patchListener !== "function") throw new Error("the third argument of a producer should not be set or a function")
    }

    // if state is a primitive, don't bother proxying at all
    if (typeof baseState !== "object" || baseState === null) {
        const returnValue = producer(baseState)
        return returnValue === undefined
            ? baseState
            : normalizeResult(returnValue)
    }

    if (!isProxyable(baseState))
        throw new Error(
            `the first argument to an immer producer should be a primitive, plain object or array, got ${typeof baseState}: "${baseState}"`
        )
    return normalizeResult(
        getUseProxies()
            ? produceProxy(baseState, producer, patchListener)
            : produceEs5(baseState, producer, patchListener)
    )
}

function normalizeResult(result) {
    return result === NOTHING ? undefined : result
}

export default produce

export const applyPatches = produce(applyPatchesImpl)

export const nothing = NOTHING
