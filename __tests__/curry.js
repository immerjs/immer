"use strict"
import produce, {setUseProxies} from "../src/immer"

runTests("proxy", true)
runTests("es5", false)

function runTests(name, useProxies) {
    describe("curry - " + name, () => {
        setUseProxies(useProxies)

        it("should check arguments", () => {
            expect(() => produce()).toThrow(/produce expects 1 or 2 arguments/)
            expect(() => produce(() => {}, {})).toThrow(
                /the second argument to produce should be a function/
            )
            expect(() => produce(new Buffer(""), () => {})).toThrow(
                /the first argument to an immer producer should be a primitive, plain object or array/
            )
            expect(() => produce({}, () => {}, [])).toThrow(
                /produce expects 1 or 2 arguments/
            )
            expect(() => produce({}, {})).toThrow(/should be a function/)
            expect(() => produce({})).toThrow(
                /first argument should be a function/
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
    })
}
