const {assign} = Object
const {ownKeys} = Reflect
const SymbolConstructor = Symbol

Symbol = undefined
Object.assign = undefined
Reflect.ownKeys = undefined

jest.resetModules()
const common = require("../src/common")

// Reset the globals to avoid unintended effects.
Symbol = SymbolConstructor
Object.assign = assign
Reflect.ownKeys = ownKeys

describe("Symbol", () => {
    test("NOTHING", () => {
        const value = common.NOTHING
        expect(value).toBeTruthy()
        expect(typeof value).toBe("object")
    })
    test("DRAFTABLE", () => {
        const value = common.DRAFTABLE
        expect(typeof value).toBe("string")
    })
    test("DRAFT_STATE", () => {
        const value = common.DRAFT_STATE
        expect(typeof value).toBe("string")
    })
})

describe("Object.assign", () => {
    const {assign} = common

    it("only copies enumerable keys", () => {
        const src = {a: 1}
        Object.defineProperty(src, "b", {value: 1})
        const dest = {}
        assign(dest, src)
        expect(dest.a).toBe(1)
        expect(dest.b).toBeUndefined()
    })

    it("only copies own properties", () => {
        const src = Object.create({a: 1})
        src.b = 1
        const dest = {}
        assign(dest, src)
        expect(dest.a).toBeUndefined()
        expect(dest.b).toBe(1)
    })
})

describe("Reflect.ownKeys", () => {
    const {ownKeys} = common

    // Symbol keys are always last.
    it("includes symbol keys", () => {
        const s = SymbolConstructor()
        const obj = {[s]: 1, b: 1}
        expect(ownKeys(obj)).toEqual(["b", s])
    })

    it("includes non-enumerable keys", () => {
        const obj = {a: 1}
        Object.defineProperty(obj, "b", {value: 1})
        expect(ownKeys(obj)).toEqual(["a", "b"])
    })
})
