"use strict"
import produce, {
    setAutoFreeze,
    setUseProxies,
    nothing,
    isDraft
} from "../src/immer"
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

function runBaseTest(name, useProxies, freeze, useListener) {
    describe(`base functionality - ${name}`, () => {
        let baseState
        let origBaseState
        // make sure logic doesn't break when listener is attached
        let listener = useListener ? function() {} : undefined

        beforeEach(() => {
            setAutoFreeze(freeze)
            setUseProxies(useProxies)
            origBaseState = baseState = createBaseState()
        })

        it("should return the original without modifications", () => {
            const nextState = produce(baseState, () => {}, listener)
            expect(nextState).toBe(baseState)
        })

        it("should return the original without modifications when reading stuff", () => {
            const nextState = produce(
                baseState,
                s => {
                    expect(s.aProp).toBe("hi")
                    expect(s.anObject.nested).toMatchObject({yummie: true})
                },
                listener
            )
            expect(nextState).toBe(baseState)
        })

        it("should return a copy when modifying stuff", () => {
            const nextState = produce(
                baseState,
                s => {
                    s.aProp = "hello world"
                },
                listener
            )
            expect(nextState).not.toBe(baseState)
            expect(baseState.aProp).toBe("hi")
            expect(nextState.aProp).toBe("hello world")
            // structural sharing?
            expect(nextState.nested).toBe(baseState.nested)
        })

        it("should preserve type", () => {
            const nextState = produce(
                baseState,
                s => {
                    expect(Object.getPrototypeOf(s)).toBe(Object.prototype)
                    expect(Array.isArray(s.anArray)).toBe(true)
                    s.anArray.push(3)
                    s.aProp = "hello world"
                    expect(Object.getPrototypeOf(s)).toBe(Object.prototype)
                    expect(Array.isArray(s.anArray)).toBe(true)
                },
                listener
            )
            expect(Object.getPrototypeOf(nextState)).toBe(Object.prototype)
            expect(Array.isArray(nextState.anArray)).toBe(true)
        })

        it("deep change bubbles up", () => {
            const nextState = produce(
                baseState,
                s => {
                    s.anObject.nested.yummie = false
                },
                listener
            )
            expect(nextState).not.toBe(baseState)
            expect(nextState.anObject).not.toBe(baseState.anObject)
            expect(baseState.anObject.nested.yummie).toBe(true)
            expect(nextState.anObject.nested.yummie).toBe(false)
            expect(nextState.anArray).toBe(baseState.anArray)
        })

        it("can add props", () => {
            const nextState = produce(
                baseState,
                s => {
                    s.anObject.cookie = {tasty: true}
                },
                listener
            )
            expect(nextState).not.toBe(baseState)
            expect(nextState.anObject).not.toBe(baseState.anObject)
            expect(nextState.anObject.nested).toBe(baseState.anObject.nested)
            expect(nextState.anObject.cookie).toEqual({tasty: true})
        })

        it("can delete props", () => {
            const nextState = produce(
                baseState,
                s => {
                    delete s.anObject.nested
                },
                listener
            )
            expect(nextState).not.toBe(baseState)
            expect(nextState.anObject).not.toBe(baseState.anObject)
            expect(nextState.anObject.nested).toBe(undefined)
        })

        it("ignores single non-modification", () => {
            const nextState = produce(
                baseState,
                s => {
                    s.aProp = "hi"
                },
                listener
            )
            expect(nextState).toBe(baseState)
        })

        it("processes single modification", () => {
            const nextState = produce(
                baseState,
                s => {
                    s.aProp = "hello"
                    s.aProp = "hi"
                },
                listener
            )
            expect(nextState).not.toBe(baseState)
            expect(nextState).toEqual(baseState)
        })

        it("processes with for loop", () => {
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

        it("works with objects without proto", () => {
            const base = Object.create(null)
            base.x = 1
            base.y = Object.create(null)
            base.y.y = 2
            expect(base.__proto__).toBe(undefined)
            const next = produce(
                base,
                draft => {
                    draft.y.z = 3
                    draft.y.y++
                    draft.x++
                },
                listener
            )
            expect(next).toEqual({
                x: 2,
                y: {y: 3, z: 3}
            })
            expect(next.__proto__).toBe(undefined)
        })

        it("should support reading arrays", () => {
            const nextState = produce(
                baseState,
                s => {
                    s.anArray.slice()
                },
                listener
            )
            expect(nextState.anArray).toBe(baseState.anArray)
            expect(nextState).toBe(baseState)
        })

        it("should support changing arrays", () => {
            const nextState = produce(
                baseState,
                s => {
                    s.anArray[3] = true
                },
                listener
            )
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).not.toBe(baseState.anArray)
            expect(nextState.anArray[3]).toEqual(true)
        })

        it("should support changing arrays - 2", () => {
            const nextState = produce(
                baseState,
                s => {
                    s.anArray.splice(1, 1, "a", "b")
                },
                listener
            )
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
            const nextState = produce(
                baseState,
                s => {
                    s.anArray.length = 3
                },
                listener
            )
            expect(nextState).not.toBe(baseState)
            expect(nextState.anObject).toBe(baseState.anObject)
            expect(nextState.anArray).not.toBe(baseState.anArray)
            expect(nextState.anArray).toEqual([3, 2, {c: 3}])
        })

        it("should support sorting arrays", () => {
            const nextState = produce(
                baseState,
                s => {
                    s.anArray[2].c = 4
                    s.anArray.sort()
                    s.anArray[3].c = 5
                },
                listener
            )
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).not.toBe(baseState.anArray)
            expect(enumerableOnly(nextState.anArray)).toEqual([1, 2, 3, {c: 5}])
        })

        it("should expose property descriptors", () => {
            const nextState = produce(
                [],
                s => {
                    expect(Object.getOwnPropertyDescriptor(s, 0)).toBe(
                        undefined
                    )
                    s.unshift("x")
                    expect(Object.getOwnPropertyDescriptor(s, 0)).toEqual({
                        configurable: true,
                        enumerable: true,
                        value: "x",
                        writable: true
                    })
                    expect(s.length).toBe(1)
                    expect(s[0] === "x").toBe(true)
                },
                listener
            )
            expect(nextState).toEqual(["x"])
            expect(Object.getOwnPropertyDescriptor(nextState, 0)).toEqual({
                configurable: !freeze,
                enumerable: true,
                value: "x",
                writable: !freeze
            })
        })

        it("should support sorting arrays - 2", () => {
            const nextState = produce(
                baseState,
                s => {
                    s.anArray.unshift("x")
                    s.anArray[3].c = 4
                    s.anArray.sort()
                    s.anArray[3].c = 5
                    s.anArray.unshift("y")
                },
                listener
            )
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
            const nextState = produce(
                baseState,
                s => {
                    s.anArray[2].test = true
                },
                listener
            )
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).not.toBe(baseState.anArray)
            expect(nextState.anArray).toEqual([3, 2, {c: 3, test: true}, 1])
        })

        it("reusing object should work", () => {
            const nextState = produce(
                baseState,
                s => {
                    const obj = s.anObject
                    delete s.anObject
                    s.messy = obj
                },
                listener
            )
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
            const nextState = produce(
                baseState,
                s => {
                    const obj = s.anObject
                    s.aProp = "hello"
                    delete s.anObject
                    obj.coffee = true
                    s.messy = obj
                },
                listener
            )
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
            const nextState = produce(
                baseState,
                s => {
                    s.aProp = undefined
                },
                listener
            )
            expect(nextState).not.toBe(baseState)
            expect(baseState.aProp).toBe("hi")
            expect(nextState.aProp).toBe(undefined)
        })

        // ES implementation does't protect against all outside modifications, just some..
        if (useProxies) {
            it("should revoke the proxy of the baseState after immer function is executed", () => {
                let proxy
                const nextState = produce(
                    baseState,
                    s => {
                        proxy = s
                        s.aProp = "hello"
                    },
                    listener
                )
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
            const nextState = produce(
                baseState,
                s => {
                    proxy = s.anObject
                },
                listener
            )
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
            produce(
                baseState,
                draft => {
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
                },
                listener
            )
        })

        it("should be able to get property descriptors from objects", () => {
            produce(
                {a: 1},
                draft => {
                    expect("a" in draft).toBe(true)
                    expect("b" in draft).toBe(false)
                    expect(
                        Reflect.ownKeys(draft).filter(
                            x => typeof x === "string"
                        )
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
                        Reflect.ownKeys(draft).filter(
                            x => typeof x === "string"
                        )
                    ).toEqual(["a", "b"])
                },
                listener
            )
        })

        it("should be able to get property descriptors from arrays", () => {
            produce(
                [1],
                draft => {
                    expect(0 in draft).toBe(true)
                    expect(1 in draft).toBe(false)
                    expect("0" in draft).toBe(true)
                    expect("1" in draft).toBe(false)
                    expect(length in draft).toBe(true)
                    expect(
                        Reflect.ownKeys(draft).filter(
                            x => typeof x === "string"
                        )
                    ).toEqual(["0", "length"])

                    expect(
                        Object.getOwnPropertyDescriptor(draft, "length")
                    ).toMatchObject({
                        configurable: false,
                        enumerable: false
                    })
                    draft[0] = 2
                    expect(
                        Object.getOwnPropertyDescriptor(draft, 0)
                    ).toMatchObject({
                        configurable: true,
                        enumerable: true
                    })
                    expect(
                        Object.getOwnPropertyDescriptor(draft, 0)
                    ).toMatchObject({
                        configurable: true,
                        enumerable: true
                    })
                    expect(
                        Object.getOwnPropertyDescriptor(draft, 1)
                    ).toBeUndefined()
                    draft[1] = 2
                    expect(
                        Object.getOwnPropertyDescriptor(draft, 1)
                    ).toMatchObject({
                        configurable: true,
                        enumerable: true
                    })
                    expect(
                        Reflect.ownKeys(draft).filter(
                            x => typeof x === "string"
                        )
                    ).toEqual(["0", "1", "length"])
                },
                listener
            )
        })

        if (useProxies === true) {
            it("should not be possible to set property descriptors", () => {
                expect(() => {
                    produce(
                        {},
                        draft => {
                            Object.defineProperty(draft, "xx", {
                                enumerable: true,
                                writeable: true,
                                value: 2
                            })
                        },
                        listener
                    )
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
            const result = produce(
                base,
                draft => {
                    draft.arr = draft.arr.filter(item => item.count > 2)
                },
                listener
            )
            expect(result.arr[0].count).toEqual(3)
            expect(result).toEqual({
                arr: [{count: 3}]
            })
            expect(result.arr[0]).toBe(base.arr[2])
        })

        it("should not throw error, see #53 - 2", () => {
            const base = {arr: [{count: 1}, {count: 2}, {count: 3}]}
            const result = produce(
                base,
                draft => {
                    draft.newArr = draft.arr.filter(item => item.count > 2)
                },
                listener
            )
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
            const result = produce(
                base,
                draft => {
                    draft.newArr = draft.arr.filter(item => item.count > 2)
                    delete draft.arr
                },
                listener
            )
            expect(result.newArr[0].count).toEqual(3)
            expect(result).toEqual({
                newArr: [{count: 3}]
            })
            expect(result.newArr[0]).toBe(base.arr[2])
        })

        it("should not throw error, see #53 - 4", () => {
            const base = {bear: {age: 10}}
            const result = produce(
                base,
                draft => {
                    draft.bear.legs = 4
                    draft.room = {elephant: {kiddo: draft.bear}}
                },
                listener
            )
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

        it("should not throw error #78", () => {
            const base = {
                arr: [
                    {
                        id: "100",
                        arr: [{id: "1", no: 1}, {id: "2", no: 2}]
                    },
                    {id: "3", no: 3}
                ]
            }
            const result = produce(base, draft => {
                const base = draft.arr[0]
                draft.arr = draft.arr.slice(0, 1)
                const newArr = {
                    id: "101",
                    arr: [base, {id: "3"}]
                }
                draft.arr.splice(0, 1, newArr)
                draft.arr[0].arr[1].no = 3
            })
            expect(result).toEqual({
                arr: [
                    {
                        id: "101",
                        arr: [
                            {
                                id: "100",
                                arr: [{id: "1", no: 1}, {id: "2", no: 2}]
                            },
                            {id: "3", no: 3}
                        ]
                    }
                ]
            })
        })

        it("should not throw error #78 - 2", () => {
            const base = {
                arr: [{count: 1}, {count: 2}]
            }
            const result = produce(base, draft => {
                draft.arr = [draft.arr[1]]
                draft.arr[0].count = 1
            })
            expect(result).toEqual({
                arr: [{count: 1}]
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

        describe("nested immer.produce() call", () => {
            describe("with non-draft object", () => {
                // This test ensures the global state used to manage proxies is
                // never left in a corrupted state by a nested `produce` call.
                it("never affects its parent producer implicitly", () => {
                    const bear = {paw: {honey: true}}
                    const next = produce(
                        bear,
                        draft => {
                            const paw2 = produce(bear.paw, draft => {
                                draft.honey = false
                            })
                            expect(paw2.honey).toBe(false)
                            expect(draft.paw.honey).toBe(true) // effects should not be visible outside
                        },
                        listener
                    )
                    expect(next.paw.honey).toBe(true)
                    expect(next).toBe(bear)
                })

                it("returns a normal object", () => {
                    const bear = {paw: {honey: true}}
                    const next = produce(
                        bear,
                        draft => {
                            const paw2 = produce(bear.paw, draft => {
                                draft.honey = false
                            })
                            expect(paw2.honey).toBe(false)
                            expect(draft.paw.honey).toBe(true)
                            draft.paw = paw2
                            expect(draft.paw.honey).toBe(false)
                        },
                        listener
                    )
                    expect(next.paw.honey).toBe(false)
                    expect(next).not.toBe(bear)
                })
            })

            describe("with a draft object", () => {
                it("always reuses the draft", () => {
                    const bear = {paw: {honey: true}}
                    const next = produce(
                        bear,
                        bear => {
                            const paw2 = produce(bear.paw, paw => {
                                expect(paw).toBe(bear.paw)
                                paw.honey = false
                            })
                            expect(paw2).toBe(bear.paw)
                            expect(paw2.honey).toBe(false)
                            expect(bear.paw.honey).toBe(false)
                        },
                        listener
                    )
                    expect(next.paw.honey).toBe(false)
                    expect(next).not.toBe(bear)
                })
            })
        })

        it("should not try to change immutable data, see #66", () => {
            const user = require("./test-data")

            const base = {}
            const next = produce(
                base,
                draft => {
                    draft.user = user
                },
                listener
            )
            expect(next.user).toBe(user)
            expect(next).not.toBe(base)
            expect(next.user).toEqual(user)
        })

        it("should not try to change immutable data, see #66 - 2", () => {
            const user = deepFreeze(cloneDeep(require("./test-data")))

            const base = {}
            const next = produce(
                base,
                draft => {
                    draft.user = user
                },
                listener
            )
            expect(next.user).toBe(user)
            expect(next).not.toBe(base)
            expect(next.user).toEqual(user)
        })

        it("should structurally share identical objects in the tree", () => {
            const base = {bear: {legs: 4}, eagle: {legs: 3}}
            const next = produce(
                base,
                draft => {
                    const animal = draft.bear
                    animal.legs = animal.legs + 1
                    draft.bear = animal
                    draft.eagle = animal
                    draft.cow = animal
                    draft.kiddo = animal
                },
                listener
            )
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
                produce(
                    {},
                    draft => {
                        expect(() =>
                            Object.setPrototypeOf(draft, Array)
                        ).toThrow(/does not support `setPrototype/)
                    },
                    listener
                )
            })

        it("'in' should work", () => {
            produce(
                createBaseState(),
                draft => {
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
                },
                listener
            )
        })

        it("'this' should work - 1", () => {
            const base = {x: 3}
            const next1 = produce(
                base,
                function() {
                    this.x = 4
                },
                listener
            )
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

        it("issue #89", () => {
            const state = {
                users: {
                    existingID: {
                        loading: false,
                        value: "val"
                    }
                }
            }
            const nextState = produce(
                state,
                draft => {
                    draft.users.existingID = {
                        ...draft.users.existingID,
                        loading: true
                    }
                },
                listener
            )
            expect(nextState).toEqual({
                users: {
                    existingID: {
                        loading: true,
                        value: "val"
                    }
                }
            })
        })

        it("processes with lodash.set", () => {
            const base = [{id: 1, a: 1}]
            const result = produce(
                base,
                draft => {
                    lodash.set(draft, "[0].a", 2)
                },
                listener
            )
            expect(base[0].a).toEqual(1)
            expect(result[0].a).toEqual(2)
        })

        it("processes with lodash.find", () => {
            const base = [{id: 1, a: 1}]
            const result = produce(
                base,
                draft => {
                    const obj1 = lodash.find(draft, {id: 1})
                    lodash.set(obj1, "a", 2)
                },
                listener
            )
            expect(base[0].a).toEqual(1)
            expect(result[0].a).toEqual(2)
        })

        it("can produce from no state", () => {
            expect(
                produce(
                    3,
                    draft => {
                        expect(draft).toBe(3)
                        return 5
                    },
                    listener
                )
            ).toBe(5)
        })

        it("can return something new ", () => {
            const base = {x: 3}
            const res = produce(
                base,
                draft => {
                    return {x: draft.x + 1}
                },
                listener
            )
            expect(res).not.toBe(base)
            expect(res).toEqual({x: 4})
        })

        it("can return the draft new ", () => {
            const base = {x: 3}
            const res = produce(
                base,
                draft => {
                    draft.x = 4
                    return draft
                },
                listener
            )
            expect(res).not.toBe(base)
            expect(res).toEqual({x: 4})
        })

        it("should throw if modifying the draft and returning something new", () => {
            const base = {x: 3}
            expect(() => {
                produce(
                    base,
                    draft => {
                        draft.x = 4
                        return {x: 5}
                    },
                    listener
                )
            }).toThrow(/An immer producer returned a new value/)
        })

        it("should fix #116", () => {
            const nextState = produce(
                [1, 2, 3],
                s => {
                    s.pop()
                    s.push(100)
                },
                listener
            )
            expect(nextState).toEqual([1, 2, 100])
        })

        it("should fix #117", () => {
            const reducer = (state, action) =>
                produce(
                    state,
                    draft => {
                        switch (action.type) {
                            case "SET_STARTING_DOTS":
                                return draft.availableStartingDots.map(a => a)
                            default:
                                break
                        }
                    },
                    listener
                )
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
                produce(
                    state,
                    draft => {
                        switch (action.type) {
                            case "SET_STARTING_DOTS":
                                return {
                                    dots: draft.availableStartingDots.map(
                                        a => a
                                    )
                                }
                            default:
                                break
                        }
                    },
                    listener
                )
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
            const nextState = produce(
                baseState,
                () => {
                    /* no modification  */
                },
                listener
            )
            expect(nextState).toBe(baseState)
        })

        it("should return an unmodified null baseState (#148)", () => {
            const baseState = null
            const nextState = produce(
                baseState,
                () => {
                    /* no modification  */
                },
                listener
            )
            expect(nextState).toBe(baseState)
        })

        it("should not detect noop assignments - 0", () => {
            const baseState = {x: {y: 3}}
            const nextState = produce(
                baseState,
                d => {
                    const a = d.x
                    d.x = a
                },
                listener
            )
            expect(nextState).toBe(baseState)
        })

        it("should not detect noop assignments - 1", () => {
            const baseState = {x: {y: 3}}
            const nextState = produce(
                baseState,
                d => {
                    const a = d.x
                    d.x = 4
                    d.x = a
                },
                listener
            )
            // Ideally, this should actually be the same instances
            // but this would be pretty expensive to detect,
            // so we don't atm
            expect(nextState).not.toBe(baseState)
        })

        it("should not detect noop assignments - 2", () => {
            const baseState = {x: {y: 3}}
            const nextState = produce(
                baseState,
                d => {
                    const a = d.x
                    const stuff = a.y + 3
                    d.x = 4
                    d.x = a
                },
                listener
            )
            // Ideally, this should actually be the same instances
            // but this would be pretty expensive to detect,
            // so we don't atm
            expect(nextState).not.toBe(baseState)
        })

        it("should not detect noop assignments - 3", () => {
            const baseState = {x: 3}
            const nextState = produce(
                baseState,
                d => {
                    d.x = 3
                },
                listener
            )
            expect(nextState).toBe(baseState)
        })

        it("should not detect noop assignments - 4", () => {
            const baseState = {x: 3}
            const nextState = produce(
                baseState,
                d => {
                    d.x = 4
                    d.x = 3
                },
                listener
            )
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

        // TODO: use fuzz testing
        {
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
                    expect(
                        produce(value, draft => {
                            expect(draft).toBe(value)
                        })
                    ).toBe(value)
                })
            }
            const objects = {
                "empty object": {},
                "plain object": {a: 1, b: {c: 1}},
                "frozen object": Object.freeze({}),
                "null-prototype object": Object.create(null),
                "empty array": [],
                "plain array": [1, [2, [3, []]]],
                "frozen array": Object.freeze([])
            }
            for (const name in objects) {
                describe("base state type - " + name, () => {
                    const value = objects[name]
                    it("returns a copy when changes are made", () => {
                        const random = Math.random()
                        const result = produce(value, draft => {
                            if (Array.isArray(value)) {
                                draft.push(random)
                            } else {
                                draft[random] = true
                            }
                        })
                        expect(result).not.toBe(value)
                        expect(result.constructor).toBe(value.constructor)
                        if (Array.isArray(value)) {
                            expect(result[result.length - 1]).toBe(random)
                        } else {
                            expect(result[random]).toBe(true)
                        }
                    })
                    it("should ", () => {})
                    expect(
                        produce(value, draft => {
                            expect(draft).not.toBe(value)
                            expect(value).toEqual(draft)
                        })
                    ).toBe(value)
                })
            }
        }

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

    describe(`isDraft - ${name}`, () => {
        beforeAll(() => {
            setAutoFreeze(freeze)
            setUseProxies(useProxies)
        })

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

function enumerableOnly(x) {
    // this can be done better...
    return JSON.parse(JSON.stringify(x))
}
