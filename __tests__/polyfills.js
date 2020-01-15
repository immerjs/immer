const {assign} = Object
const {ownKeys} = Reflect
const SymbolConstructor = Symbol

Symbol = undefined
Object.assign = undefined
Reflect.ownKeys = undefined

jest.resetModules()
const common = require("../src/internal")

// Reset the globals to avoid unintended effects.
Symbol = SymbolConstructor
Object.assign = assign
Reflect.ownKeys = ownKeys

if (!global.USES_BUILD)
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

if (!global.USES_BUILD)
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

test("suppress jest warning", () => {
	expect(true).toBe(true)
})
