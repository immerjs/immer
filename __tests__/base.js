"use strict"
import * as immerProxy from "../src/immer"
import * as immerEs5 from "../src/es5"
import deepFreeze from "deep-freeze"

jest.setTimeout(1000)

runBaseTest("proxy (no freeze)", immerProxy, false)
runBaseTest("proxy (autofreeze)", immerProxy, true)
runBaseTest("es5 (no freeze)", immerEs5, false)
runBaseTest("es5 (autofreeze)", immerEs5, true)

function runBaseTest(name, lib, freeze) {
    describe(`base functionality - ${name}`, () => {
        const produce = lib.default
        let baseState
        let origBaseState

        beforeEach(() => {
            lib.setAutoFreeze(freeze)
            origBaseState = baseState = createBaseState()
        })

        it("should return the original without modifications", () => {
            const nextState = produce(baseState, () => {})
            expect(nextState).toBe(baseState)
        })

        it("should return the original without modifications when reading stuff", () => {
            const nextState = produce(baseState, s => {
                expect(s.aProp).toBe("hi")
                expect(s.anObject.nested).toMatchObject({yummie: true})
            })
            expect(nextState).toBe(baseState)
        })

        it("should not return any value: thunk", () => {
            const warning = jest.spyOn(console, "warn")
            produce(baseState, () => ({bad: "don't do this"}))
            produce(baseState, () => [1, 2, 3])
            produce(baseState, () => false)
            produce(baseState, () => "")

            expect(warning).toHaveBeenCalledTimes(4)
            warning.mockClear()
        })

        it("should return a copy when modifying stuff", () => {
            const nextState = produce(baseState, s => {
                s.aProp = "hello world"
            })
            expect(nextState).not.toBe(baseState)
            expect(baseState.aProp).toBe("hi")
            expect(nextState.aProp).toBe("hello world")
            // structural sharing?
            expect(nextState.nested).toBe(baseState.nested)
        })

        if (
            ("should preserve type",
            () => {
                const nextState = produce(baseState, s => {
                    expect(Array.isArray(s)).toBe(true)
                    expect(s.protoType).toBe(Object)
                    s.anArray.push(3)
                    s.aProp = "hello world"
                    expect(Array.isArray(s)).toBe(true)
                    expect(s.protoType).toBe(Object)
                })
                expect(Array.isArray(nextState)).toBe(true)
                expect(nextState.protoType).toBe(Object)
            })
        )
            it("deep change bubbles up", () => {
                const nextState = produce(baseState, s => {
                    s.anObject.nested.yummie = false
                })
                expect(nextState).not.toBe(baseState)
                expect(nextState.anObject).not.toBe(baseState.anObject)
                expect(baseState.anObject.nested.yummie).toBe(true)
                expect(nextState.anObject.nested.yummie).toBe(false)
                expect(nextState.anArray).toBe(baseState.anArray)
            })

        it("can add props", () => {
            const nextState = produce(baseState, s => {
                s.anObject.cookie = {tasty: true}
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anObject).not.toBe(baseState.anObject)
            expect(nextState.anObject.nested).toBe(baseState.anObject.nested)
            expect(nextState.anObject.cookie).toEqual({tasty: true})
        })

        it("can delete props", () => {
            const nextState = produce(baseState, s => {
                delete s.anObject.nested
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anObject).not.toBe(baseState.anObject)
            expect(nextState.anObject.nested).toBe(undefined)
        })

        it("ignores single non-modification", () => {
            const nextState = produce(baseState, s => {
                s.aProp = "hi"
            })
            expect(nextState).toBe(baseState)
        })

        it("processes single modification", () => {
            const nextState = produce(baseState, s => {
                s.aProp = "hello"
                s.aProp = "hi"
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState).toEqual(baseState)
        })

        it("should support reading arrays", () => {
            const nextState = produce(baseState, s => {
                s.anArray.slice()
            })
            expect(nextState.anArray).toBe(baseState.anArray)
            expect(nextState).toBe(baseState)
        })

        it("should support changing arrays", () => {
            const nextState = produce(baseState, s => {
                s.anArray[3] = true
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).not.toBe(baseState.anArray)
            expect(nextState.anArray[3]).toEqual(true)
        })

        it("should support changing arrays - 2", () => {
            const nextState = produce(baseState, s => {
                s.anArray.splice(1, 1, "a", "b")
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).not.toBe(baseState.anArray)

            expect(enumerableOnly(nextState.anArray)).toEqual([
                3,
                "a",
                "b",
                {c: 3},
                1
            ])
        })

        it("can delete array items", () => {
            const nextState = produce(baseState, s => {
                s.anArray.length = 3
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anObject).toBe(baseState.anObject)
            expect(nextState.anArray).not.toBe(baseState.anArray)
            expect(nextState.anArray).toEqual([3, 2, {c: 3}])
        })

        it("should support sorting arrays", () => {
            const nextState = produce(baseState, s => {
                s.anArray[2].c = 4
                s.anArray.sort()
                s.anArray[3].c = 5
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).not.toBe(baseState.anArray)
            expect(enumerableOnly(nextState.anArray)).toEqual([1, 2, 3, {c: 5}])
        })

        it("should expose property descriptors", () => {
            const nextState = produce([], s => {
                expect(Object.getOwnPropertyDescriptor(s, 0)).toBe(undefined)
                s.unshift("x")
                expect(Object.getOwnPropertyDescriptor(s, 0)).toEqual({
                    configurable: true,
                    enumerable: true,
                    value: "x",
                    writable: true
                })
                expect(s.length).toBe(1)
                expect(s[0] === "x").toBe(true)
            })
            expect(nextState).toEqual(["x"])
            expect(Object.getOwnPropertyDescriptor(nextState, 0)).toEqual({
                configurable: !freeze,
                enumerable: true,
                value: "x",
                writable: !freeze
            })
        })

        it("should support sorting arrays - 2", () => {
            const nextState = produce(baseState, s => {
                s.anArray.unshift("x")
                s.anArray[3].c = 4
                s.anArray.sort()
                s.anArray[3].c = 5
                s.anArray.unshift("y")
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).not.toBe(baseState.anArray)
            expect(enumerableOnly(nextState.anArray)).toEqual([
                "y",
                1,
                2,
                3,
                {c: 5},
                "x"
            ])
        })

        it("should updating inside arrays", () => {
            const nextState = produce(baseState, s => {
                s.anArray[2].test = true
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).not.toBe(baseState.anArray)
            expect(nextState.anArray).toEqual([3, 2, {c: 3, test: true}, 1])
        })

        it("reusing object should work", () => {
            const nextState = produce(baseState, s => {
                const obj = s.anObject
                delete s.anObject
                s.messy = obj
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).toBe(baseState.anArray)
            expect(enumerableOnly(nextState)).toEqual({
                anArray: [3, 2, {c: 3}, 1],
                aProp: "hi",
                messy: {
                    nested: {
                        yummie: true
                    },
                    coffee: false
                }
            })
            expect(nextState.messy.nested).toBe(baseState.anObject.nested)
        })

        it("refs should be transparent", () => {
            const nextState = produce(baseState, s => {
                const obj = s.anObject
                s.aProp = "hello"
                delete s.anObject
                obj.coffee = true
                s.messy = obj
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).toBe(baseState.anArray)
            expect(enumerableOnly(nextState)).toEqual({
                anArray: [3, 2, {c: 3}, 1],
                aProp: "hello",
                messy: {
                    nested: {
                        yummie: true
                    },
                    coffee: true
                }
            })
            expect(nextState.messy.nested).toBe(baseState.anObject.nested)
        })

        it("should allow setting to undefined a defined draft property", () => {
            const nextState = produce(baseState, s => {
                s.aProp = undefined
            })
            expect(nextState).not.toBe(baseState)
            expect(baseState.aProp).toBe("hi")
            expect(nextState.aProp).toBe(undefined)
        })

        // ES implementation does't protect against all outside modifications, just some..
        if (lib === immerProxy) {
            it("should revoke the proxy of the baseState after immer function is executed", () => {
                let proxy
                const nextState = produce(baseState, s => {
                    proxy = s
                    s.aProp = "hello"
                })
                expect(nextState).not.toBe(baseState)
                expect(baseState.aProp).toBe("hi")
                expect(nextState.aProp).toBe("hello")

                expect(() => {
                    proxy.aProp = "Hallo"
                }).toThrowError(/revoked/)
                expect(() => {
                    const aProp = proxy.aProp
                }).toThrowError(/revoked/)

                expect(nextState).not.toBe(baseState)
                expect(baseState.aProp).toBe("hi")
                expect(nextState.aProp).toBe("hello")
            })
        }

        it("should revoke the proxy of the baseState after immer function is executed - 2", () => {
            let proxy
            const nextState = produce(baseState, s => {
                proxy = s.anObject
            })
            expect(nextState).toBe(baseState)
            expect(() => {
                // In ES5 implemenation only protects existing props, but alas..
                proxy.coffee = "Hallo"
            }).toThrowError(/revoked/)
            expect(() => {
                const test = proxy.coffee
            }).toThrowError(/revoked/)
        })

        it("should reflect all changes made in the draft immediately", () => {
            produce(baseState, draft => {
                draft.anArray[0] = 5
                draft.anArray.unshift("test")
                // sliced here; jest will also compare non-enumerable keys, which would include the immer Symbols
                expect(draft.anArray.slice()).toMatchObject([
                    "test",
                    5,
                    2,
                    {c: 3},
                    1
                ])
                draft.stuffz = "coffee"
                expect(draft.stuffz).toBe("coffee")
            })
        })

        it("should be able to get property descriptors from objects", () => {
            produce({a: 1}, draft => {
                expect("a" in draft).toBe(true)
                expect("b" in draft).toBe(false)
                expect(
                    Reflect.ownKeys(draft).filter(x => typeof x === "string")
                ).toEqual(["a"])

                expect(
                    Object.getOwnPropertyDescriptor(draft, "a")
                ).toMatchObject({
                    configurable: true,
                    enumerable: true
                })
                draft.a = 2
                expect(
                    Object.getOwnPropertyDescriptor(draft, "a")
                ).toMatchObject({
                    configurable: true,
                    enumerable: true
                })
                expect(
                    Object.getOwnPropertyDescriptor(draft, "b")
                ).toBeUndefined()
                draft.b = 2
                expect(
                    Object.getOwnPropertyDescriptor(draft, "b")
                ).toMatchObject({
                    configurable: true,
                    enumerable: true
                })
                expect("a" in draft).toBe(true)
                expect("b" in draft).toBe(true)
                expect(
                    Reflect.ownKeys(draft).filter(x => typeof x === "string")
                ).toEqual(["a", "b"])
            })
        })

        it("should be able to get property descriptors from arrays", () => {
            produce([1], draft => {
                expect(0 in draft).toBe(true)
                expect(1 in draft).toBe(false)
                expect("0" in draft).toBe(true)
                expect("1" in draft).toBe(false)
                expect(length in draft).toBe(true)
                expect(
                    Reflect.ownKeys(draft).filter(x => typeof x === "string")
                ).toEqual(["0", "length"])

                expect(
                    Object.getOwnPropertyDescriptor(draft, "length")
                ).toMatchObject({
                    configurable: false,
                    enumerable: false
                })
                draft[0] = 2
                expect(Object.getOwnPropertyDescriptor(draft, 0)).toMatchObject(
                    {
                        configurable: true,
                        enumerable: true
                    }
                )
                expect(Object.getOwnPropertyDescriptor(draft, 0)).toMatchObject(
                    {
                        configurable: true,
                        enumerable: true
                    }
                )
                expect(
                    Object.getOwnPropertyDescriptor(draft, 1)
                ).toBeUndefined()
                draft[1] = 2
                expect(Object.getOwnPropertyDescriptor(draft, 1)).toMatchObject(
                    {
                        configurable: true,
                        enumerable: true
                    }
                )
                expect(
                    Reflect.ownKeys(draft).filter(x => typeof x === "string")
                ).toEqual(["0", "1", "length"])
            })
        })

        if (lib === immerProxy)
            it("should not be possible to set property descriptors", () => {
                expect(() => {
                    produce({}, draft => {
                        Object.defineProperty(draft, "xx", {
                            enumerable: true,
                            writeable: true,
                            value: 2
                        })
                    })
                }).toThrowError(/not support/)
            })

        it("should not throw error, see #53 - 1", () => {
            const base = {arr: [{count: 1}, {count: 2}, {count: 3}]}
            const result = produce(base, draft => {
                draft.arr = draft.arr.filter(item => item.count > 2)
            })
            expect(result.arr[0].count).toEqual(3)
            expect(result).toEqual({
                arr: [{count: 3}]
            })
            expect(result.arr[0]).toBe(base.arr[2])
        })

        it("should not throw error, see #53 - 2", () => {
            const base = {arr: [{count: 1}, {count: 2}, {count: 3}]}
            const result = produce(base, draft => {
                draft.newArr = draft.arr.filter(item => item.count > 2)
            })
            expect(result.newArr[0].count).toEqual(3)
            expect(result.arr).toBe(base.arr)
            expect(result).toEqual({
                arr: [
                    {
                        count: 1
                    },
                    {
                        count: 2
                    },
                    {
                        count: 3
                    }
                ],
                newArr: [
                    {
                        count: 3
                    }
                ]
            })
            expect(result.newArr[0]).toBe(base.arr[2])
            expect(result.arr[2]).toBe(base.arr[2])
        })

        it("should not throw error, see #53 - 3", () => {
            const base = {arr: [{count: 1}, {count: 2}, {count: 3}]}
            const result = produce(base, draft => {
                draft.newArr = draft.arr.filter(item => item.count > 2)
                delete draft.arr
            })
            expect(result.newArr[0].count).toEqual(3)
            expect(result).toEqual({
                newArr: [{count: 3}]
            })
            expect(result.newArr[0]).toBe(base.arr[2])
        })

        it("should not throw error, see #53 - 4", () => {
            debugger
            const base = {bear: {age: 10}}
            const result = produce(base, draft => {
                draft.bear.legs = 4
                draft.room = {elephant: {kiddo: draft.bear}}
            })
            expect(result).toEqual({
                bear: {age: 10, legs: 4},
                room: {elephant: {kiddo: {age: 10, legs: 4}}}
            })

            const result2 = produce(result, draft => {
                draft.bear.age = 11
                draft.room.elephant.kiddo.legs = 5
            })
            expect(result2).toEqual({
                bear: {age: 11, legs: 4},
                room: {elephant: {kiddo: {age: 10, legs: 5}}}
            })
        })

        it("should handle dates correctly", () => {
            const data = {date: new Date()}
            const next = produce(data, draft => {
                draft.x = true
            })
            expect(next).toEqual({x: true, date: data.date})
            expect(next.date).toBe(data.date)
            const next2 = produce(next, draft => {
                draft.date.setYear(2015)
            })
            // This still holds; because produce won't proxy Date objects
            // and the original is actually modified!
            expect(next2).toEqual({x: true, date: data.date})
            expect(next2.date).toBe(next.date)
            expect(next2.date).toBe(data.date)
            expect(next2).toBe(next)
        })

        it("should handle equality correctly - 1", () => {
            const base = {
                y: 3 / 0,
                z: NaN
            }
            const next = produce(base, draft => {
                draft.y = 4 / 0
                draft.z = NaN
            })
            expect(next).toEqual(base)
            expect(next).toBe(base)
        })

        it("should handle equality correctly - 2", () => {
            const base = {
                x: -0
            }
            const next = produce(base, draft => {
                draft.x = +1
            })
            expect(next).not.toEqual(base)
            expect(next).not.toBe(base)
        })

        it("should handle nested immer calls correctly - 1", () => {
            const bear = {paw: {honey: true}}
            const next = produce(bear, draft => {
                const paw2 = produce(bear.paw, draft => {
                    draft.honey = false
                })
                expect(paw2.honey).toBe(false)
                expect(draft.paw.honey).toBe(true) // effects should not be visible outside
            })
            expect(next.paw.honey).toBe(true)
            expect(next).toBe(bear)
        })

        it("should handle nested immer calls correctly - 2", () => {
            const bear = {paw: {honey: true}}
            const next = produce(bear, draft => {
                const paw2 = produce(bear.paw, draft => {
                    draft.honey = false
                })
                expect(paw2.honey).toBe(false)
                expect(draft.paw.honey).toBe(true)
                draft.paw = paw2
                expect(draft.paw.honey).toBe(false)
            })
            expect(next.paw.honey).toBe(false)
            expect(next).not.toBe(bear)
        })

        afterEach(() => {
            expect(baseState).toBe(origBaseState)
            expect(baseState).toEqual(createBaseState())
        })

        function createBaseState() {
            const data = {
                anArray: [3, 2, {c: 3}, 1],
                aProp: "hi",
                anObject: {
                    nested: {
                        yummie: true
                    },
                    coffee: false
                }
            }
            return freeze ? deepFreeze(data) : data
        }
    })
}

function enumerableOnly(x) {
    // this can be done better...
    return JSON.parse(JSON.stringify(x))
}
