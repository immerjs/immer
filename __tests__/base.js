import immer from ".."

describe("base", () => {
    let baseState
    let origBaseState

    beforeEach(() => {
        origBaseState = baseState = createBaseState()
    })

    it("should return the original without modifications", () => {
        const nextState = immer(baseState, () => {})
        expect(nextState).toBe(baseState)
    })

    it("should return the original without modifications when reading stuff", () => {
        const nextState = immer(baseState, s => {
            expect(s.aProp).toBe("hi")
            expect(s.anObject.nested).toEqual({yummie: true})
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

        expect(nextState.anArray).toEqual([3, "a", "b", {c: 3}, 1])
    })

    it("should support sorting arrays", () => {
        const nextState = immer(baseState, s => {
            s.anArray[2].c = 4
            s.anArray.sort()
            s.anArray[3].c = 5
        })
        expect(nextState).not.toBe(baseState)
        expect(nextState.anArray).not.toBe(baseState.anArray)
        expect(nextState.anArray).toEqual([1, 2, 3, {c: 5}])
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
            debugger
            const obj = s.anObject
            delete s.anObject
            s.messy = obj
        })
        expect(nextState).not.toBe(baseState)
        expect(nextState.anArray).toBe(baseState.anArray)
        expect(nextState).toEqual({
            anArray: [3, 2, {c: 3}, 1],
            aProp: "hi",
            messy: {
                nested: {
                    yummie: true,
                },
                coffee: false,
            },
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
        expect(nextState).toEqual({
            anArray: [3, 2, {c: 3}, 1],
            aProp: "hello",
            messy: {
                nested: {
                    yummie: true,
                },
                coffee: true,
            },
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

    afterEach(() => {
        expect(baseState).toBe(origBaseState)
        expect(baseState).toEqual(createBaseState())
    })

    function createBaseState() {
        return {
            anArray: [3, 2, {c: 3}, 1],
            aProp: "hi",
            anObject: {
                nested: {
                    yummie: true,
                },
                coffee: false,
            },
        }
    }
})

describe("readme example", () => {
    it("works", () => {
        const baseState = [
            {
                todo: "Learn typescript",
                done: true,
            },
            {
                todo: "Try immer",
                done: false,
            },
        ]

        const nextState = immer(baseState, state => {
            state.push({todo: "Tweet about it"})
            state[1].done = true
        })

        // the new item is only added to the next state,
        // base state is unmodified
        expect(baseState.length).toBe(2)
        expect(nextState.length).toBe(3)

        // same for the changed 'done' prop
        expect(baseState[1].done).toBe(false)
        expect(nextState[1].done).toBe(true)

        // unchanged data is structurally shared
        expect(nextState[0]).toBe(baseState[0])
        // changed data not (dûh)
        expect(nextState[1]).not.toBe(baseState[1])
    })
})
