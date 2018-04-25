"use strict"
import produce, {setUseProxies} from "../src/immer"

runTests("proxy", true)
runTests("es5", false)

function runTests(name, useProxies) {
    describe("curry - " + name, () => {
        setUseProxies(useProxies)

        it("should check arguments", () => {
            expect(() => produce()).toThrow(/produce expects 1 or 2 arguments/)
            expect(() => produce(new Buffer(""), () => {})).toThrow(
                /the first argument to an immer producer should be a primitive, plain object or array/
            )
            expect(() => produce({}, () => {}, [])).toThrow(
                /produce expects 1 or 2 arguments/
            )
            expect(() => produce({}, {})).toThrow(/should be a function/)
            expect(() => produce({})).toThrow(
                /if first argument is not a function, the second argument to produce should be a function/
            )
            expect(() => produce(() => {}, () => {})).toThrow(
                /if first argument is a function .* the second argument to produce cannot be a function/
            )
        })

        it("should support currying", () => {
            const state = [{}, {}, {}]
            const mapper = produce((item, index) => {
                item.index = index
            })

            expect(state.map(mapper)).not.toBe(state)
            expect(state.map(mapper)).toEqual([
                {index: 0},
                {index: 1},
                {index: 2}
            ])
            expect(state).toEqual([{}, {}, {}])
        })

        it("should support returning new states from curring", () => {
            const reducer = produce((item, index) => {
                if (!item) {
                    return {hello: "world"}
                }
                item.index = index
            })

            expect(reducer(undefined, 3)).toEqual({hello: "world"})
            expect(reducer({}, 3)).toEqual({index: 3})
        })

        it("should support passing an initial state as second argument", () => {
            const reducer = produce(
                (item, index) => {
                    item.index = index
                },
                {hello: "world"}
            )

            expect(reducer(undefined, 3)).toEqual({hello: "world", index: 3})
            expect(reducer({}, 3)).toEqual({index: 3})
        })
    })
}
