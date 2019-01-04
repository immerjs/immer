"use strict"
import {Immer, nothing, original, isDraft} from "../src/index"
import {shallowCopy} from "../src/common"
import deepFreeze from "deep-freeze"
import cloneDeep from "lodash.clonedeep"
import * as lodash from "lodash"

jest.setTimeout(1000)

runBaseTest("proxy (no freeze)", true, false)
runBaseTest("proxy (autofreeze)", true, true)
runBaseTest("proxy (autofreeze)(patch listener)", true, true, true)
runBaseTest("es5 (no freeze)", false, false)
runBaseTest("es5 (autofreeze)", false, true)
runBaseTest("es5 (autofreeze)(patch listener)", false, true, true)

function runBaseTest(name, useProxies, autoFreeze, useListener) {
    const listener = useListener ? function() {} : undefined
    const {produce} = createPatchedImmer({
        useProxies,
        autoFreeze
    })

    // When `useListener` is true, append a function to the arguments of every
    // uncurried `produce` call in every test. This makes tests easier to read.
    function createPatchedImmer(options) {
        const immer = new Immer(options)

        const {produce} = immer
        immer.produce = (...args) =>
            typeof args[1] === "function" && args.length < 3
                ? produce(...args, listener)
                : produce(...args)

        return immer
    }

    describe(`base functionality - ${name}`, () => {
        let baseState
        let origBaseState

        beforeEach(() => {
            origBaseState = baseState = createBaseState()
        })

        it("returns the original state when no changes are made", () => {
            const nextState = produce(baseState, s => {
                expect(s.aProp).toBe("hi")
                expect(s.anObject.nested).toMatchObject({yummie: true})
            })
            expect(nextState).toBe(baseState)
        })

        it("does structural sharing", () => {
            const random = Math.random()
            const nextState = produce(baseState, s => {
                s.aProp = random
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.aProp).toBe(random)
            expect(nextState.nested).toBe(baseState.nested)
        })

        it("preserves the prototype of drafts", () => {
            const getProto = Object.getPrototypeOf
            const nextState = produce(baseState, s => {
                expect(getProto(s)).toBe(Object.prototype)
                expect(getProto(s.anArray)).toBe(Array.prototype)
                s.aProp = Math.random()
                s.anArray.push(1)
            })
            expect(getProto(nextState)).toBe(Object.prototype)
            expect(getProto(nextState.anArray)).toBe(Array.prototype)
        })

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

        // Found by: https://github.com/mweststrate/immer/pull/267
        it("can delete props added in the producer", () => {
            const nextState = produce(baseState, s => {
                s.anObject.test = true
                delete s.anObject.test
            })
            if (useProxies) {
                expect(nextState).not.toBe(baseState)
                expect(nextState).toEqual(baseState)
            } else {
                // The copy is avoided in ES5.
                expect(nextState).toBe(baseState)
            }
        })

        it("ignores single non-modification", () => {
            const nextState = produce(baseState, s => {
                s.aProp = "hi"
            })
            expect(nextState).toBe(baseState)
        })

        // Once a draft is marked as modified, it stays that way.
        it("never removes modified properties from its internal state", () => {
            const nextState = produce(baseState, s => {
                const original = s.aProp
                // This assignment marks the draft as modified.
                s.aProp = "hello"
                // This assignment reverts the property to its original value,
                // but Immer cannot detect this, so the base state is copied anyway.
                s.aProp = original
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState).toEqual(baseState)
        })

        describe("array drafts", () => {
            it("supports Array.isArray()", () => {
                const nextState = produce(baseState, s => {
                    expect(Array.isArray(s.anArray)).toBeTruthy()
                    s.anArray.push(1)
                })
                expect(Array.isArray(nextState.anArray)).toBeTruthy()
            })

            it("supports index access", () => {
                const value = baseState.anArray[0]
                const nextState = produce(baseState, s => {
                    expect(s.anArray[0]).toBe(value)
                })
                expect(nextState).toBe(baseState)
            })

            it("supports iteration", () => {
                const base = [{id: 1, a: 1}, {id: 2, a: 1}]
                const findById = (collection, id) => {
                    for (const item of collection) {
                        if (item.id === id) return item
                    }
                    return null
                }
                const result = produce(base, draft => {
                    const obj1 = findById(draft, 1)
                    const obj2 = findById(draft, 2)
                    obj1.a = 2
                    obj2.a = 2
                })
                expect(result[0].a).toEqual(2)
                expect(result[1].a).toEqual(2)
            })

            it("can assign an index via bracket notation", () => {
                const nextState = produce(baseState, s => {
                    s.anArray[3] = true
                })
                expect(nextState).not.toBe(baseState)
                expect(nextState.anArray).not.toBe(baseState.anArray)
                expect(nextState.anArray[3]).toEqual(true)
            })

            it("can use splice() to both add and remove items", () => {
                const nextState = produce(baseState, s => {
                    s.anArray.splice(1, 1, "a", "b")
                })
                expect(nextState.anArray).not.toBe(baseState.anArray)
                expect(nextState.anArray[1]).toBe("a")
                expect(nextState.anArray[2]).toBe("b")
            })

            it("can truncate via the length property", () => {
                const baseLength = baseState.anArray.length
                const nextState = produce(baseState, s => {
                    s.anArray.length = baseLength - 1
                })
                expect(nextState.anArray).not.toBe(baseState.anArray)
                expect(nextState.anArray.length).toBe(baseLength - 1)
            })

            it("can extend via the length property", () => {
                const baseLength = baseState.anArray.length
                const nextState = produce(baseState, s => {
                    s.anArray.length = baseLength + 1
                })
                expect(nextState.anArray).not.toBe(baseState.anArray)
                expect(nextState.anArray.length).toBe(baseLength + 1)
            })

            // Reported here: https://github.com/mweststrate/immer/issues/116
            it("can pop then push", () => {
                const nextState = produce([1, 2, 3], s => {
                    s.pop()
                    s.push(100)
                })
                expect(nextState).toEqual([1, 2, 100])
            })

            it("can be sorted", () => {
                const baseState = [3, 1, 2]
                const nextState = produce(baseState, s => {
                    s.sort()
                })
                expect(nextState).not.toBe(baseState)
                expect(nextState).toEqual([1, 2, 3])
            })

            it("supports modifying nested objects", () => {
                const baseState = [{a: 1}, {}]
                const nextState = produce(baseState, s => {
                    s[0].a++
                    s[1].a = 0
                })
                expect(nextState).not.toBe(baseState)
                expect(nextState[0].a).toBe(2)
                expect(nextState[1].a).toBe(0)
            })
        })

        it("supports access of property descriptors", () => {
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
                configurable: !autoFreeze,
                enumerable: true,
                value: "x",
                writable: !autoFreeze
            })
        })

        it("can rename nested objects (no changes)", () => {
            const nextState = produce(baseState, s => {
                const obj = s.anObject
                delete s.anObject
                s.renamed = obj
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).toBe(baseState.anArray)
            expect(nextState.renamed.nested).toBe(baseState.anObject.nested)
            expect(enumerableOnly(nextState)).toEqual({
                anArray: [3, 2, {c: 3}, 1],
                aProp: "hi",
                renamed: {
                    nested: {
                        yummie: true
                    },
                    coffee: false
                }
            })
        })

        // Very similar to the test before, but the reused object has one
        // property changed, one added, and one removed.
        it("can rename nested objects (with changes)", () => {
            const nextState = produce(baseState, s => {
                const obj = s.anObject
                delete s.anObject

                obj.coffee = true // change
                obj.nested.yummy = true // add
                delete obj.nested.yummie // delete

                s.renamed = obj
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).toBe(baseState.anArray)
            expect(nextState.renamed.nested).not.toBe(baseState.anObject.nested)
            expect(enumerableOnly(nextState)).toEqual({
                anArray: [3, 2, {c: 3}, 1],
                aProp: "hi",
                renamed: {
                    nested: {
                        yummy: true
                    },
                    coffee: true
                }
            })
        })

        it("can nest a draft in a new object (no changes)", () => {
            const nextState = produce(baseState, s => {
                s.foo = {bar: s.anObject}
                delete s.anObject
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.foo.bar).toBe(baseState.anObject)
        })

        it("can nest a draft in a new object (with changes)", () => {
            const nextState = produce(baseState, s => {
                const obj = s.anObject
                delete s.anObject

                obj.coffee = true // change
                obj.nested.yummy = true // add
                delete obj.nested.yummie // delete

                s.foo = {bar: obj}
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.foo.bar).not.toBe(baseState.anObject)
            expect(nextState.foo).toEqual({
                bar: {
                    coffee: true,
                    nested: {yummy: true}
                }
            })
        })

        it("supports assigning undefined to an existing property", () => {
            const nextState = produce(baseState, s => {
                s.aProp = undefined
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.aProp).toBe(undefined)
        })

        it("supports assigning undefined to a new property", () => {
            const baseState = {}
            const nextState = produce(baseState, s => {
                s.aProp = undefined
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.aProp).toBe(undefined)
        })

        // NOTE: ES5 drafts only protect existing properties when revoked.
        it("revokes the draft once produce returns", () => {
            const expectRevoked = (fn, shouldThrow = true) => {
                if (shouldThrow) expect(fn).toThrowError(/revoked/)
                else expect(fn).not.toThrow()
            }

            // Test object drafts:
            let draft
            produce({a: 1, b: 1}, s => {
                draft = s
                delete s.b
            })

            // Access known property on object draft.
            expectRevoked(() => {
                draft.a
            })

            // Assign known property on object draft.
            expectRevoked(() => {
                draft.a = true
            })

            // Access unknown property on object draft.
            expectRevoked(() => {
                draft.z
            }, useProxies)

            // Assign unknown property on object draft.
            expectRevoked(() => {
                draft.z = true
            }, useProxies)

            // Test array drafts:
            produce([1, 2], s => {
                draft = s
                s.pop()
            })

            // Access known index of an array draft.
            expectRevoked(() => {
                draft[0]
            })

            // Assign known index of an array draft.
            expectRevoked(() => {
                draft[0] = true
            })

            // Access unknown index of an array draft.
            expectRevoked(() => {
                draft[1]
            }, useProxies)

            // Assign unknown index of an array draft.
            expectRevoked(() => {
                draft[1] = true
            }, useProxies)
        })

        it("can access a child draft that was created before the draft was modified", () => {
            produce({a: {}}, s => {
                const before = s.a
                s.b = 1
                expect(s.a).toBe(before)
            })
        })

        it("should reflect all changes made in the draft immediately", () => {
            produce(baseState, draft => {
                draft.anArray[0] = 5
                draft.anArray.unshift("test")
                expect(enumerableOnly(draft.anArray)).toEqual([
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

        if (useProxies === true) {
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

            it("should not be possible to add properties to arrays", () => {
                expect(() => {
                    produce([], d => {
                        d.x = 3
                    })
                }).toThrow(
                    "Immer does not support setting non-numeric properties on arrays"
                )
            })

            it("should not be possible to remove properties from arrays", () => {
                expect(() => {
                    const base = []
                    base.x = 7
                    produce(base, d => {
                        delete d.x
                    })
                }).toThrow(
                    "Immer does not support deleting properties from arrays"
                )
            })
        }

        it("non-numeric array properties will be lost", () => {
            const base = []
            base.x = 7
            const next = produce(base, d => {
                d.push(3)
            })
            expect(next.x).toBe(undefined)
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

        it("should handle constructor correctly", () => {
            const base = {
                arr: new Array(),
                obj: new Object()
            }
            const result = produce(base, draft => {
                draft.arrConstructed = draft.arr.constructor(1)
                draft.objConstructed = draft.obj.constructor(1)
            })
            expect(result.arrConstructed).toEqual(new Array().constructor(1))
            expect(result.objConstructed).toEqual(new Object().constructor(1))
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

        // AKA: recursive produce calls
        describe("a nested producer", () => {
            describe("when base state is not a draft", () => {
                // This test ensures the global state used to manage proxies is
                // never left in a corrupted state by a nested `produce` call.
                it("never affects its parent producer implicitly", () => {
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

                it("returns a normal object", () => {
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
            })

            describe("when base state is a draft", () => {
                it("always reuses the draft", () => {
                    const bear = {paw: {honey: true}}
                    const next = produce(bear, bear => {
                        const paw2 = produce(bear.paw, paw => {
                            expect(paw).toBe(bear.paw)
                            paw.honey = false
                        })
                        expect(paw2).toBe(bear.paw)
                        expect(paw2.honey).toBe(false)
                        expect(bear.paw.honey).toBe(false)
                    })
                    expect(next.paw.honey).toBe(false)
                    expect(next).not.toBe(bear)
                })
            })

            describe("when base state contains a draft", () => {
                it("wraps unowned draft with its own draft", () => {
                    produce({a: {}}, parent => {
                        produce({a: parent.a}, child => {
                            expect(child.a).not.toBe(parent.a)
                            expect(isDraft(child.a)).toBeTruthy()
                        })
                    })
                })

                it("returns unowned draft if no changes were made", () => {
                    produce({a: {}}, parent => {
                        const result = produce({a: parent.a}, () => {})
                        expect(result.a).toBe(parent.a)
                    })
                })

                it("clones the unowned draft when changes are made", () => {
                    produce({a: {}}, parent => {
                        const result = produce({a: parent.a}, child => {
                            child.a.b = 1
                        })
                        expect(result.a).not.toBe(parent.a)
                        expect(result.a.b).toBe(1)
                        expect("b" in parent.a).toBeFalsy()
                    })
                })

                // We cannot auto-freeze the result of a nested producer,
                // because it may contain a draft from a parent producer.
                it("never auto-freezes the result", () => {
                    produce({a: {}}, parent => {
                        const r = produce({a: parent.a}, child => {
                            child.b = 1 // Ensure a copy is returned.
                        })
                        expect(Object.isFrozen(r)).toBeFalsy()
                    })
                })
            })

            // "Upvalues" are variables from a parent scope.
            it("does not finalize upvalue drafts", () => {
                produce({a: {}, b: {}}, parent => {
                    expect(produce({}, () => parent)).toBe(parent)
                    parent.x // Ensure proxy not revoked.

                    expect(produce({}, () => [parent])[0]).toBe(parent)
                    parent.x // Ensure proxy not revoked.

                    expect(produce({}, () => parent.a)).toBe(parent.a)
                    parent.a.x // Ensure proxy not revoked.

                    // Modified parent test
                    parent.c = 1
                    expect(produce({}, () => [parent.b])[0]).toBe(parent.b)
                    parent.b.x // Ensure proxy not revoked.
                })
            })

            it("works with interweaved Immer instances", () => {
                const options = {useProxies, autoFreeze}
                const one = createPatchedImmer(options)
                const two = createPatchedImmer(options)

                const base = {}
                const result = one.produce(base, s1 =>
                    two.produce({s1}, s2 => {
                        expect(original(s2.s1)).toBe(s1)
                        s2.n = 1
                        s2.s1 = one.produce({s2}, s3 => {
                            expect(original(s3.s2)).toBe(s2)
                            expect(original(s3.s2.s1)).toBe(s2.s1)
                            return s3.s2.s1
                        })
                    })
                )
                expect(result.n).toBe(1)
                expect(result.s1).toBe(base)
            })
        })

        it("should not try to change immutable data, see #66", () => {
            const user = require("./test-data")

            const base = {}
            const next = produce(base, draft => {
                draft.user = user
            })
            expect(next.user).toBe(user)
            expect(next).not.toBe(base)
            expect(next.user).toEqual(user)
        })

        it("should not try to change immutable data, see #66 - 2", () => {
            const user = deepFreeze(cloneDeep(require("./test-data")))

            const base = {}
            const next = produce(base, draft => {
                draft.user = user
            })
            expect(next.user).toBe(user)
            expect(next).not.toBe(base)
            expect(next.user).toEqual(user)
        })

        it("should structurally share identical objects in the tree", () => {
            const base = {bear: {legs: 4}, eagle: {legs: 3}}
            const next = produce(base, draft => {
                const animal = draft.bear
                animal.legs = animal.legs + 1
                draft.bear = animal
                draft.eagle = animal
                draft.cow = animal
                draft.kiddo = animal
            })
            expect(next).toEqual({
                bear: {legs: 5},
                eagle: {legs: 5},
                cow: {legs: 5},
                kiddo: {legs: 5}
            })
            expect(next.bear).toBe(next.cow)
            expect(next.kiddo).toBe(next.cow)
        })

        if (useProxies)
            it("should not allow changing prototype", () => {
                produce({}, draft => {
                    expect(() => Object.setPrototypeOf(draft, Array)).toThrow(
                        /does not support `setPrototype/
                    )
                })
            })

        it("'in' should work", () => {
            produce(createBaseState(), draft => {
                expect("anArray" in draft).toBe(true)
                expect(Reflect.has(draft, "anArray")).toBe(true)

                expect("bla" in draft).toBe(false)
                expect(Reflect.has(draft, "bla")).toBe(false)

                expect(0 in draft.anArray).toBe(true)
                expect("0" in draft.anArray).toBe(true)
                expect(Reflect.has(draft.anArray, 0)).toBe(true)
                expect(Reflect.has(draft.anArray, "0")).toBe(true)

                expect(17 in draft.anArray).toBe(false)
                expect("17" in draft.anArray).toBe(false)
                expect(Reflect.has(draft.anArray, 17)).toBe(false)
                expect(Reflect.has(draft.anArray, "17")).toBe(false)
            })
        })

        it("'this' should work - 1", () => {
            const base = {x: 3}
            const next1 = produce(base, function() {
                this.x = 4
            })
            expect(next1).not.toBe(base)
            expect(next1.x).toBe(4)
        })

        it("'this' should work - 1", () => {
            const base = {x: 3}
            const incrementor = produce(function() {
                this.x = 4
            })
            const next1 = incrementor(base)
            expect(next1).not.toBe(base)
            expect(next1.x).toBe(4)
        })

        // See here: https://github.com/mweststrate/immer/issues/89
        it("works with the spread operator", () => {
            const base = {foo: {x: 0, y: 0}, bar: [0, 0]}
            const result = produce(base, draft => {
                draft.foo = {x: 1, ...draft.foo, y: 1}
                draft.bar = [1, ...draft.bar, 1]
            })
            expect(result).toEqual({
                foo: {x: 0, y: 1},
                bar: [1, 0, 0, 1]
            })
        })

        it("processes with lodash.set", () => {
            const base = [{id: 1, a: 1}]
            const result = produce(base, draft => {
                lodash.set(draft, "[0].a", 2)
            })
            expect(base[0].a).toEqual(1)
            expect(result[0].a).toEqual(2)
        })

        it("processes with lodash.find", () => {
            const base = [{id: 1, a: 1}]
            const result = produce(base, draft => {
                const obj1 = lodash.find(draft, {id: 1})
                lodash.set(obj1, "a", 2)
            })
            expect(base[0].a).toEqual(1)
            expect(result[0].a).toEqual(2)
        })

        it("can produce from no state", () => {
            expect(
                produce(3, draft => {
                    expect(draft).toBe(3)
                    return 5
                })
            ).toBe(5)
        })

        it("can return something new ", () => {
            const base = {x: 3}
            const res = produce(base, draft => {
                return {x: draft.x + 1}
            })
            expect(res).not.toBe(base)
            expect(res).toEqual({x: 4})
        })

        it("can return the draft new ", () => {
            const base = {x: 3}
            const res = produce(base, draft => {
                draft.x = 4
                return draft
            })
            expect(res).not.toBe(base)
            expect(res).toEqual({x: 4})
        })

        it("should throw if modifying the draft and returning something new", () => {
            const base = {x: 3}
            expect(() => {
                produce(base, draft => {
                    draft.x = 4
                    return {x: 5}
                })
            }).toThrow(/An immer producer returned a new value/)
        })

        it("should fix #117", () => {
            const reducer = (state, action) =>
                produce(state, draft => {
                    switch (action.type) {
                        case "SET_STARTING_DOTS":
                            return draft.availableStartingDots.map(a => a)
                        default:
                            break
                    }
                })
            const base = {
                availableStartingDots: [
                    {dots: 4, count: 1},
                    {dots: 3, count: 2},
                    {dots: 2, count: 3},
                    {dots: 1, count: 4}
                ]
            }
            const next = reducer(base, {type: "SET_STARTING_DOTS"})
            expect(next).toEqual(base.availableStartingDots)
            expect(next).not.toBe(base.availableStartingDots)
        })

        it("should fix #117 - 2", () => {
            const reducer = (state, action) =>
                produce(state, draft => {
                    switch (action.type) {
                        case "SET_STARTING_DOTS":
                            return {
                                dots: draft.availableStartingDots.map(a => a)
                            }
                        default:
                            break
                    }
                })
            const base = {
                availableStartingDots: [
                    {dots: 4, count: 1},
                    {dots: 3, count: 2},
                    {dots: 2, count: 3},
                    {dots: 1, count: 4}
                ]
            }
            const next = reducer(base, {type: "SET_STARTING_DOTS"})
            expect(next).toEqual({dots: base.availableStartingDots})
        })

        it("should return an unmodified primitive baseState (#148)", () => {
            const baseState = "some string"
            const nextState = produce(baseState, () => {
                /* no modification  */
            })
            expect(nextState).toBe(baseState)
        })

        it("should return an unmodified null baseState (#148)", () => {
            const baseState = null
            const nextState = produce(baseState, () => {
                /* no modification  */
            })
            expect(nextState).toBe(baseState)
        })

        it("should not detect noop assignments - 0", () => {
            const baseState = {x: {y: 3}}
            const nextState = produce(baseState, d => {
                const a = d.x
                d.x = a
            })
            expect(nextState).toBe(baseState)
        })

        it("should not detect noop assignments - 1", () => {
            const baseState = {x: {y: 3}}
            const nextState = produce(baseState, d => {
                const a = d.x
                d.x = 4
                d.x = a
            })
            // Ideally, this should actually be the same instances
            // but this would be pretty expensive to detect,
            // so we don't atm
            expect(nextState).not.toBe(baseState)
        })

        it("should not detect noop assignments - 2", () => {
            const baseState = {x: {y: 3}}
            const nextState = produce(baseState, d => {
                const a = d.x
                const stuff = a.y + 3
                d.x = 4
                d.x = a
            })
            // Ideally, this should actually be the same instances
            // but this would be pretty expensive to detect,
            // so we don't atm
            expect(nextState).not.toBe(baseState)
        })

        it("should not detect noop assignments - 3", () => {
            const baseState = {x: 3}
            const nextState = produce(baseState, d => {
                d.x = 3
            })
            expect(nextState).toBe(baseState)
        })

        it("should not detect noop assignments - 4", () => {
            const baseState = {x: 3}
            const nextState = produce(baseState, d => {
                d.x = 4
                d.x = 3
            })
            // Ideally, this should actually be the same instances
            // but this would be pretty expensive to detect,
            // so we don't atm
            expect(nextState).not.toBe(baseState)
        })

        it("immer should have no dependencies", () => {
            expect(require("../package.json").dependencies).toEqual(undefined)
        })

        it("#174", () => {
            const nextState = produce([1, 2, 3], s => {
                s.pop()
                s.push(100)
            })
            expect(nextState).toEqual([1, 2, 100])
        })

        it("#195 should be able to find items", () => {
            const state = {
                items: [
                    {
                        id: 0,
                        task: "drink milk"
                    },
                    {id: 1, task: "eat cookie"}
                ]
            }
            produce(state, draft => {
                expect(draft.items.find(({id}) => id === 1).task).toBe(
                    "eat cookie"
                )
            })
        })

        it("allows a function as the base state", () => {
            let fn = () => {}
            expect(
                produce(fn, draft => {
                    expect(fn).toBe(draft)
                })
            ).toBe(fn)
        })

        it("cannot return and produce undefined!", () => {
            const base = 3
            expect(produce(base, () => 4)).toBe(4)
            expect(produce(base, () => null)).toBe(null)
            expect(produce(base, () => undefined)).toBe(3)
            expect(produce(base, () => {})).toBe(3)
            expect(produce(base, () => nothing)).toBe(undefined)

            expect(produce({}, () => undefined)).toEqual({})
            expect(produce({}, () => nothing)).toBe(undefined)
            expect(produce(3, () => nothing)).toBe(undefined)

            expect(produce(() => undefined)({})).toEqual({})
            expect(produce(() => nothing)({})).toBe(undefined)
            expect(produce(() => nothing)(3)).toBe(undefined)
        })

        testBaseStateTypes(produce)

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
            return autoFreeze ? deepFreeze(data) : data
        }
    })

    describe(`isDraft - ${name}`, () => {
        it("returns true for object drafts", () => {
            produce({}, state => {
                expect(isDraft(state)).toBeTruthy()
            })
        })
        it("returns true for array drafts", () => {
            produce([], state => {
                expect(isDraft(state)).toBeTruthy()
            })
        })
        it("returns true for objects nested in object drafts", () => {
            produce({a: {b: {}}}, state => {
                expect(isDraft(state.a)).toBeTruthy()
                expect(isDraft(state.a.b)).toBeTruthy()
            })
        })
        it("returns false for new objects added to a draft", () => {
            produce({}, state => {
                state.a = {}
                expect(isDraft(state.a)).toBeFalsy()
            })
        })
        it("returns false for objects returned by the producer", () => {
            const object = produce(null, Object.create)
            expect(isDraft(object)).toBeFalsy()
        })
        it("returns false for arrays returned by the producer", () => {
            const array = produce(null, _ => [])
            expect(isDraft(array)).toBeFalsy()
        })
        it("returns false for object drafts returned by the producer", () => {
            const object = produce({}, state => state)
            expect(isDraft(object)).toBeFalsy()
        })
        it("returns false for array drafts returned by the producer", () => {
            const array = produce([], state => state)
            expect(isDraft(array)).toBeFalsy()
        })
    })
}

function testBaseStateTypes(produce) {
    class Foo {}
    const primitives = {
        "falsy number": 0,
        "truthy number": 1,
        "negative number": -1,
        infinity: 1 / 0,
        true: true,
        false: false,
        "empty string": "",
        "truthy string": "1",
        null: null,
        undefined: undefined,

        /**
         * These objects are treated as primitives because Immer
         * chooses not to make drafts for them.
         */
        "regexp object": /.+/g,
        "boxed number": new Number(0),
        "boxed string": new String(""),
        "boxed boolean": new Boolean(),
        "date object": new Date(),
        "class instance": new Foo()
    }
    for (const name in primitives) {
        describe("base state type - " + name, () => {
            const value = primitives[name]
            it("does not create a draft", () => {
                produce(value, draft => {
                    expect(draft).toBe(value)
                })
            })
            it("returns the same value when the producer returns undefined", () => {
                expect(produce(value, () => {})).toBe(value)
            })
            if (value && typeof value == "object") {
                it("does not return a copy when the producer makes changes", () => {
                    expect(
                        produce(value, draft => {
                            draft.foo = true
                        })
                    ).toBe(value)
                })
            }
        })
    }
    const objects = {
        "empty object": {},
        "plain object": {a: 1, b: {c: 1}},
        "frozen object": Object.freeze({}),
        "null-prototype object": Object.create(null),
        "frozen null-prototype object": Object.freeze(Object.create(null)),
        "empty array": [],
        "plain array": [1, [2, [3, []]]],
        "frozen array": Object.freeze([])
    }
    for (const name in objects) {
        describe("base state type - " + name, () => {
            const value = objects[name]
            it("creates a draft", () => {
                produce(value, draft => {
                    expect(draft).not.toBe(value)
                    expect(enumerableOnly(draft)).toEqual(value)
                })
            })
            it("returns the same value when the producer does nothing", () => {
                expect(produce(value, () => {})).toBe(value)
            })
            it("returns a copy when changes are made", () => {
                const random = Math.random()
                const result = produce(value, draft => {
                    draft[0] = random
                })
                expect(result).not.toBe(value)
                expect(result.constructor).toBe(value.constructor)
                expect(result[0]).toBe(random)
            })
        })
    }
}

function enumerableOnly(x) {
    const copy = shallowCopy(x)
    for (const key in copy) {
        const value = copy[key]
        if (value && typeof value === "object") {
            copy[key] = enumerableOnly(value)
        }
    }
    return copy
}
