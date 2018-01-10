"use strict"
import * as immerProxy from "../src/immer"
import * as immerEs5 from "../src/es5"

runTests("proxy", immerProxy)
runTests("es5", immerEs5)

function runTests(name, lib) {
    describe("curry - " + name, () => {
        const produce = lib.default

        it("should check arguments", () => {
            expect(() => produce()).toThrow(/produce expects 1 or 2 arguments/)
            expect(() => produce(() => {}, {})).toThrow(
                /the first argument to produce should be a plain object or array/
            )
            expect(() => produce(1, () => {})).toThrow(
                /the first argument to produce should be a plain object or array/
            )
            expect(() => produce({}, () => {}, [])).toThrow(
                /produce expects 1 or 2 arguments/
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
