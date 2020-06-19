const {assign, getOwnPropertyDescriptors} = Object
const {ownKeys} = Reflect
const SymbolConstructor = Symbol

const testSymbol = Symbol("test-symbol")

Symbol = undefined
Object.assign = undefined
Reflect.ownKeys = undefined
Object.getOwnPropertyDescriptors = undefined

jest.resetModules()
const common = require("../src/internal")

// Reset the globals to avoid unintended effects.
Symbol = SymbolConstructor
Object.assign = assign
Reflect.ownKeys = ownKeys
Object.getOwnPropertyDescriptors = getOwnPropertyDescriptors

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

if (!global.USES_BUILD)
	describe("Object.getOwnPropertyDescriptors", () => {
		const {getOwnPropertyDescriptors} = common

		// Symbol keys are always last.
		it("gets symbolic and nonsymbolic properties", () => {
			expect(
				Object.getOwnPropertyDescriptors({
					x: 1,
					[testSymbol]: 2
				})
			).toEqual({
				x: {
					value: 1,
					enumerable: true,
					configurable: true,
					writable: true
				},
				[testSymbol]: {
					value: 2,
					enumerable: true,
					configurable: true,
					writable: true
				}
			})
		})
	})

test("suppress jest warning", () => {
	expect(true).toBe(true)
})
