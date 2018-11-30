"use strict"
import produce, {setUseProxies} from "../src/immer"

runTests("proxy", true)
runTests("es5", false)

function runTests(name, useProxies) {
    describe("curry - " + name, () => {
        setUseProxies(useProxies)

        it("should check arguments", () => {
            let error = /if first argument is not a function, the second argument to produce should be a function/
            expect(() => produce()).toThrow(error)
            expect(() => produce({})).toThrow(error)

            expect(() => produce({}, {})).toThrow(/should be a function/)
            expect(() => produce({}, () => {}, [])).toThrow(
                /third argument of a producer/
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

        it("can has fun with change detection", () => {
            const spread = produce(Object.assign)

            const base = {
                x: 1,
                y: 1
            }

            expect({...base}).not.toBe(base)
            expect(spread(base, {})).toBe(base)
            expect(spread(base, {y: 1})).toBe(base)
            expect(spread(base, {...base})).toBe(base)
            expect(spread(base, {...base, y: 2})).not.toBe(base)
            expect(spread(base, {...base, y: 2})).toEqual({x: 1, y: 2})
            expect(spread(base, {z: 3})).toEqual({x: 1, y: 1, z: 3})
            expect(spread(base, {y: 1})).toBe(base)
        })
    })
}
