"use strict"
import * as immerProxy from ".."
import * as immerEs5 from "../es5"
import deepFreeze from "deep-freeze"

runBaseTest("proxy (no freeze)", immerProxy, false)
runBaseTest("proxy (autofreeze)", immerProxy, true)
runBaseTest("es5 (no freeze)", immerEs5, false)
runBaseTest("es5 (autofreeze)", immerEs5, true)

function runBaseTest(name, lib, freeze) {
    describe(`base functionality - ${name}`, () => {
        const immer = lib.default
        let baseState
        let origBaseState

        beforeEach(() => {
            lib.setAutoFreeze(freeze)
            origBaseState = baseState = createBaseState()
        })

        it("should return the original without modifications", () => {
            const nextState = immer(baseState, () => {})
            expect(nextState).toBe(baseState)
        })

        it("should return the original without modifications when reading stuff", () => {
            const nextState = immer(baseState, s => {
                expect(s.aProp).toBe("hi")
                expect(s.anObject.nested).toMatchObject({yummie: true})
            })
            expect(nextState).toBe(baseState)
        })

        it("should not return any value: thunk", () => {
            const warning = jest.spyOn(console, "warn")
            immer(baseState, () => ({bad: "don't do this"}))
            immer(baseState, () => [1, 2, 3])
            immer(baseState, () => false)
            immer(baseState, () => "")

            expect(warning).toHaveBeenCalledTimes(4)
            warning.mockClear()
        })

        it("should return a copy when modifying stuff", () => {
            const nextState = immer(baseState, s => {
                s.aProp = "hello world"
            })
            expect(nextState).not.toBe(baseState)
            expect(baseState.aProp).toBe("hi")
            expect(nextState.aProp).toBe("hello world")
            // structural sharing?
            expect(nextState.nested).toBe(baseState.nested)
        })

        it("deep change bubbles up", () => {
            const nextState = immer(baseState, s => {
                s.anObject.nested.yummie = false
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anObject).not.toBe(baseState.anObject)
            expect(baseState.anObject.nested.yummie).toBe(true)
            expect(nextState.anObject.nested.yummie).toBe(false)
            expect(nextState.anArray).toBe(baseState.anArray)
        })

        it("can add props", () => {
            const nextState = immer(baseState, s => {
                s.anObject.cookie = {tasty: true}
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anObject).not.toBe(baseState.anObject)
            expect(nextState.anObject.nested).toBe(baseState.anObject.nested)
            expect(nextState.anObject.cookie).toEqual({tasty: true})
        })

        it("can delete props", () => {
            const nextState = immer(baseState, s => {
                delete s.anObject.nested
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anObject).not.toBe(baseState.anObject)
            expect(nextState.anObject.nested).toBe(undefined)
        })

        it("ignores single non-modification", () => {
            const nextState = immer(baseState, s => {
                s.aProp = "hi"
            })
            expect(nextState).toBe(baseState)
        })

        it("processes single modification", () => {
            const nextState = immer(baseState, s => {
                s.aProp = "hello"
                s.aProp = "hi"
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState).toEqual(baseState)
        })

        it("should support reading arrays", () => {
            const nextState = immer(baseState, s => {
                s.anArray.slice()
            })
            expect(nextState.anArray).toBe(baseState.anArray)
            expect(nextState).toBe(baseState)
        })

        it("should support changing arrays", () => {
            const nextState = immer(baseState, s => {
                s.anArray[3] = true
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).not.toBe(baseState.anArray)
            expect(nextState.anArray[3]).toEqual(true)
        })

        it("should support changing arrays - 2", () => {
            const nextState = immer(baseState, s => {
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

        it("should support sorting arrays", () => {
            const nextState = immer(baseState, s => {
                s.anArray[2].c = 4
                s.anArray.sort()
                s.anArray[3].c = 5
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).not.toBe(baseState.anArray)
            expect(enumerableOnly(nextState.anArray)).toEqual([1, 2, 3, {c: 5}])
        })

        it.only("should support sorting arrays - 2", () => {
            const nextState = immer([], s => {
                debugger
                s.unshift("x")
                // console.dir(s)
                // console.dir(Object.getOwnPropertyDescriptor(s, "length"))
                // console.dir(Object.getOwnPropertyDescriptor(s, 0))
                expect(s.length).toBe(1)
                expect(s[0] === "x").toBe(true)
            })
            expect(nextState).toEqual(["x"])
        })

        it.only("should support sorting arrays - 2", () => {
            const nextState = immer(baseState, s => {
                debugger
                s.anArray.unshift("x")
                s.anArray[3].c = 4
                // console.dir(s.anArray)
                s.anArray.sort()
                // console.dir(s.anArray)
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
            const nextState = immer(baseState, s => {
                s.anArray[2].test = true
            })
            expect(nextState).not.toBe(baseState)
            expect(nextState.anArray).not.toBe(baseState.anArray)
            expect(nextState.anArray).toEqual([3, 2, {c: 3, test: true}, 1])
        })

        it("reusing object should work", () => {
            const nextState = immer(baseState, s => {
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
            const nextState = immer(baseState, s => {
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
            const nextState = immer(baseState, s => {
                s.aProp = undefined
            })
            expect(nextState).not.toBe(baseState)
            expect(baseState.aProp).toBe("hi")
            expect(nextState.aProp).toBe(undefined)
        })

        // ES implementation does't protect against all outside modifications, just some..
        if (name === "proxy") {
            it("should revoke the proxy of the baseState after immer function is executed", () => {
                let proxy
                const nextState = immer(baseState, s => {
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
            const nextState = immer(baseState, s => {
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
            immer(baseState, draft => {
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
