"use strict"
import produce, {
	setStrictMode,
	unsafe,
	immerable,
	enableMapSet
} from "../src/immer"

enableMapSet()

describe("Strict Mode", () => {
	class Foo {}

	describe("by default", () => {
		it("should not throw an error when accessing a non-draftable class instance", () => {
			expect(() =>
				produce({instance: new Foo()}, draft => {
					draft.instance.value = 5
				})
			).not.toThrow()
		})
	})

	afterAll(() => {
		setStrictMode(false)
	})

	describe("when disabled", () => {
		beforeEach(() => {
			setStrictMode(false)
		})

		it("should allow accessing a non-draftable class instance", () => {
			expect(() =>
				produce({instance: new Foo()}, draft => {
					draft.instance.value = 5
				})
			).not.toThrow()
		})

		it("should not throw errors when using the `unsafe` function", () => {
			expect(() =>
				produce({instance: new Foo()}, draft => {
					unsafe(() => {
						draft.instance.value = 5
					})
				})
			).not.toThrow()
		})
	})

	describe("when enabled", () => {
		beforeEach(() => {
			setStrictMode(true)
		})

		it("should throw an error when accessing a non-draftable class instance", () => {
			expect(() =>
				produce({instance: new Foo()}, draft => {
					draft.instance
				})
			).toThrow()
		})

		it("should allow accessing a non-draftable using the `unsafe` function", () => {
			expect(() =>
				produce({instance: new Foo()}, draft => {
					unsafe(() => {
						draft.instance.value = 5
					})
				})
			).not.toThrow()
		})

		it("should require using unsafe for non-draftables in a different scope", () => {
			expect.assertions(2)

			produce({instance: new Foo()}, () => {
				unsafe(() => {
					produce({nested: new Foo()}, nestedDraft => {
						expect(() => nestedDraft.nested).toThrow()

						unsafe(() => {
							expect(() => nestedDraft.nested).not.toThrow()
						})
					})
				})
			})
		})

		describe("with an immerable class", () => {
			beforeAll(() => {
				Foo[immerable] = true
			})

			afterAll(() => {
				Foo[immerable] = true
			})

			it("should allow accessing the class instance", () => {
				expect(() =>
					produce({instance: new Foo()}, draft => {
						draft.instance.value = 5
					})
				).not.toThrow()
			})
		})

		it("should allow accessing draftable properties", () => {
			expect(() =>
				produce({arr: [], obj: {}, map: new Map(), set: new Set()}, draft => {
					draft.arr.push(1)
					draft.arr[0] = 1
					draft.obj.foo = 5
					draft.obj.hasOwnProperty("abc")
					draft.map.set("foo", 5)
					draft.set.add("foo")
				})
			).not.toThrow()
		})
	})
})
