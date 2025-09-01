"use strict"
import {
	produce,
	setUseProxies,
	setAutoFreeze,
	freeze,
	enableMapSet
} from "../src/immer"

enableMapSet()

const {isFrozen} = Object

runTests("proxy", true)

function runTests(name) {
	describe("auto freeze - " + name, () => {
		beforeAll(() => {
			setAutoFreeze(true)
		})

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

		it("freezes reused base state", () => {
			const base = {arr: [1], obj: {a: 1}}
			const next = produce(base, draft => {
				draft.arr.push(1)
			})
			expect(next.obj).toBe(base.obj)
			expect(isFrozen(next.obj)).toBeTruthy()
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

			it("a new object replaces the entire draft", () => {
				const obj = {a: {b: {}}}
				const next = produce({}, () => obj)
				expect(next).toBe(obj)
				expect(isFrozen(next)).toBeTruthy()
				expect(isFrozen(next.a)).toBeTruthy()
				expect(isFrozen(next.a.b)).toBeTruthy()
			})

			it("a new object is added to the root draft", () => {
				const base = {}
				const next = produce(base, draft => {
					draft.a = {b: []}
				})
				expect(next).not.toBe(base)
				expect(isFrozen(next)).toBeTruthy()
				expect(isFrozen(next.a)).toBeTruthy()
				expect(isFrozen(next.b)).toBeTruthy()
			})

			it("a new object is added to a nested draft", () => {
				const base = {a: {}}
				const next = produce(base, draft => {
					draft.a.b = {c: {}}
				})
				expect(next).not.toBe(base)
				expect(isFrozen(next)).toBeTruthy()
				expect(isFrozen(next.a)).toBeTruthy()
				expect(isFrozen(next.a.b)).toBeTruthy()
				expect(isFrozen(next.a.b.c)).toBeTruthy()
			})

			it("a nested draft is returned", () => {
				const base = {a: {}}
				const next = produce(base, draft => draft.a)
				expect(next).toBe(base.a)
				expect(isFrozen(next)).toBeTruthy()
			})

			it("the base state is returned", () => {
				const base = {}
				const next = produce(base, () => base)
				expect(next).toBe(base)
				expect(isFrozen(next)).toBeTruthy()
			})

			it("the producer is a no-op", () => {
				const base = {a: {}}
				const next = produce(base, () => {})
				expect(next).toBe(base)
				expect(isFrozen(next)).toBeTruthy()
				expect(isFrozen(next.a)).toBeTruthy()
			})

			it("the root draft is returned", () => {
				const base = {a: {}}
				const next = produce(base, draft => draft)
				expect(next).toBe(base)
				expect(isFrozen(next)).toBeTruthy()
				expect(isFrozen(next.a)).toBeTruthy()
			})

			it("a new object replaces a primitive base", () => {
				const obj = {a: {}}
				const next = produce(null, () => obj)
				expect(next).toBe(obj)
				expect(isFrozen(next)).toBeTruthy()
				expect(isFrozen(next.a)).toBeTruthy()
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

		it("will freeze maps", () => {
			const base = new Map()

			const res = produce(base, draft => {
				draft.set("a", 1)
				draft.set("o", {b: 1})
			})
			expect(() => res.set("b", 2)).toThrowErrorMatchingSnapshot()
			expect(() => res.clear()).toThrowErrorMatchingSnapshot()
			expect(() => res.delete("b")).toThrowErrorMatchingSnapshot()
			expect(Object.isFrozen(res.get("o"))).toBe(true)

			// In draft, still editable
			expect(produce(res, d => void d.set("a", 2))).not.toBe(res)
		})

		it("will freeze sets", () => {
			const base = new Set()
			const res = produce(base, draft => {
				base.add(1)
			})
			expect(() => base.add(2)).toThrowErrorMatchingSnapshot()
			expect(() => base.delete(1)).toThrowErrorMatchingSnapshot()
			expect(() => base.clear()).toThrowErrorMatchingSnapshot()

			// In draft, still editable
			expect(produce(res, d => void d.add(2))).not.toBe(res)
		})

		it("Map#get() of frozen object will became draftable", () => {
			const base = {
				map: new Map([
					[
						"a",
						new Map([
							["a", true],
							["b", true],
							["c", true]
						])
					],
					["b", new Map([["a", true]])],
					["c", new Map([["a", true]])]
				])
			}

			// This will freeze maps
			const frozen = produce(base, draft => {})

			// https://github.com/immerjs/immer/issues/472
			produce(frozen, draft => {
				;["b", "c"].forEach(other => {
					const m = draft.map.get(other)

					m.delete("a")
				})
			})
		})

		it("never freezes non-enumerable fields #590", () => {
			const component = {}
			Object.defineProperty(component, "state", {
				value: {x: 1},
				enumerable: false,
				writable: true,
				configurable: true
			})

			const state = {
				x: 1
			}

			const state2 = produce(state, draft => {
				draft.ref = component
			})

			expect(() => {
				state2.ref.state.x++
			}).not.toThrow()
			expect(state2.ref.state.x).toBe(2)
			expect(component.state.x).toBe(2)
		})

		it("never freezes symbolic fields #590", () => {
			const component = {}
			const symbol = Symbol("test")
			Object.defineProperty(component, symbol, {
				value: {x: 1},
				enumerable: true,
				writable: true,
				configurable: true
			})

			const state = {
				x: 1
			}

			const state2 = produce(state, draft => {
				draft.ref = component
			})

			expect(() => {
				state2.ref[symbol].x++
			}).not.toThrow()
			expect(state2.ref[symbol].x).toBe(2)
		})
	})
}

test("freeze - shallow", () => {
	const obj1 = {hello: {world: true}}
	const res = freeze(obj1)

	expect(res).toBe(obj1)
	expect(Object.isFrozen(res)).toBe(true)
	expect(Object.isFrozen(res.hello)).toBe(false)
})

test("freeze - deep", () => {
	const obj1 = {hello: {world: true}}
	const res = freeze(obj1, true)

	expect(res).toBe(obj1)
	expect(Object.isFrozen(res)).toBe(true)
	expect(Object.isFrozen(res.hello)).toBe(true)
})
