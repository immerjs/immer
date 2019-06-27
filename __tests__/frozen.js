"use strict"
import produce, {setUseProxies, setAutoFreeze} from "../src/index"

const {isFrozen} = Object

runTests("proxy", true)
runTests("es5", false)

function runTests(name, useProxies) {
	describe("auto freeze - " + name, () => {
		setUseProxies(useProxies)
		setAutoFreeze(true)

		it("never freezes the base state", () => {
			const base = {arr: [1], obj: {a: 1}}
			const next = produce(base, draft => {
				draft.arr.push(1)
			})
			expect(isFrozen(base)).toBeFalsy()
			expect(isFrozen(base.arr)).toBeFalsy()
			expect(isFrozen(next)).toBeTruthy()
			expect(isFrozen(next.arr)).toBeTruthy()
		})

		it("never freezes reused state", () => {
			const base = {arr: [1], obj: {a: 1}}
			const next = produce(base, draft => {
				draft.arr.push(1)
			})
			expect(next.obj).toBe(base.obj)
			expect(isFrozen(next.obj)).toBeFalsy()
		})

		describe("the result is always auto-frozen when", () => {
			it("the root draft is mutated (and no error is thrown)", () => {
				const base = {}
				const next = produce(base, draft => {
					draft.a = 1
				})
				expect(next).not.toBe(base)
				expect(isFrozen(next)).toBeTruthy()
			})

			it("a nested draft is mutated (and no error is thrown)", () => {
				const base = {a: {}}
				const next = produce(base, draft => {
					draft.a.b = 1
				})
				expect(next).not.toBe(base)
				expect(isFrozen(next)).toBeTruthy()
				expect(isFrozen(next.a)).toBeTruthy()
			})
		})

		describe("the result is never auto-frozen when", () => {
			it("the producer is a no-op", () => {
				const base = {}
				const next = produce(base, () => {})
				expect(next).toBe(base)
				expect(isFrozen(next)).toBeFalsy()
			})

			it("the root draft is returned", () => {
				const base = {}
				const next = produce(base, draft => draft)
				expect(next).toBe(base)
				expect(isFrozen(next)).toBeFalsy()
			})

			it("a nested draft is returned", () => {
				const base = {a: {}}
				const next = produce(base, draft => draft.a)
				expect(next).toBe(base.a)
				expect(isFrozen(next)).toBeFalsy()
			})

			it("the base state is returned", () => {
				const base = {}
				const next = produce(base, () => base)
				expect(next).toBe(base)
				expect(isFrozen(next)).toBeFalsy()
			})

			it("a new object replaces a primitive base", () => {
				const obj = {}
				const next = produce(null, () => obj)
				expect(next).toBe(obj)
				expect(isFrozen(next)).toBeFalsy()
			})

			it("a new object replaces the entire draft", () => {
				const obj = {a: {b: {}}}
				const next = produce({}, () => obj)
				expect(next).toBe(obj)
				expect(isFrozen(next)).toBeFalsy()
				expect(isFrozen(next.a)).toBeFalsy()
				expect(isFrozen(next.a.b)).toBeFalsy()
			})

			it("a new object is added to the root draft", () => {
				const base = {}
				const next = produce(base, draft => {
					draft.a = {}
				})
				expect(next).not.toBe(base)
				expect(isFrozen(next)).toBeTruthy()
				expect(isFrozen(next.a)).toBeFalsy()
			})

			it("a new object is added to a nested draft", () => {
				const base = {a: {}}
				const next = produce(base, draft => {
					draft.a.b = {}
				})
				expect(next).not.toBe(base)
				expect(isFrozen(next)).toBeTruthy()
				expect(isFrozen(next.a)).toBeTruthy()
				expect(isFrozen(next.a.b)).toBeFalsy()
			})
		})

		it("can handle already frozen trees", () => {
			const a = []
			const b = {a: a}
			Object.freeze(a)
			Object.freeze(b)
			const n = produce(b, draft => {
				draft.c = true
				draft.a.push(3)
			})
			expect(n).toEqual({c: true, a: [3]})
		})
	})
}
