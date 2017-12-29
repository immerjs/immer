import immer from ".."

describe("base", () => {
    let baseState

    beforeEach(() => {
        baseState = createBaseState()
    })

    it("should return the original without modifications", () => {
        const nextState = immer(baseState, () => {})
        expect(nextState).toBe(baseState)
    })

    afterEach(() => {
        expect(baseState).toEqual(createBaseState())
    })
})

function createBaseState() {
    return {
        anArray: [1, 2, { c: 3 }],
        aProp: "hi",
        anObject: {
            nested: {
                yummie: true
            },
            coffee: false
        }
    }
}
