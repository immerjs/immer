export {setAutoFreeze, setUseProxies} from "./common"

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
    // curried invocation
    if (arguments.length === 1) {
        const producer = baseState
        // prettier-ignore
        if (typeof producer !== "function") throw new Error("if produce is called with 1 argument, the first argument should be a function")
        return function() {
            const args = arguments
            return produce(args[0], draft => {
                args[0] = draft // blegh!
                producer.apply(draft, args)
            })
        }
    }

    // prettier-ignore
    {
        if (arguments.length !== 2)  throw new Error("produce expects 1 or 2 arguments, got " + arguments.length)
        if (typeof producer !== "function") throw new Error("the second argument to produce should be a function")
    }

    // it state is a primitive, don't bother proxying at all and just return whatever the producer returns on that value
    if (typeof baseState !== "object" || baseState === null)
        return producer(baseState)
    if (!isProxyable(baseState))
        throw new Error(
            `the first argument to an immer producer should be a primitive, plain object or array, got ${typeof baseState}: "${baseState}"`
        )
    return getUseProxies()
        ? produceProxy(baseState, producer)
        : produceEs5(baseState, producer)
}
