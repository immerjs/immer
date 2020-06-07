import {
	setUseProxies,
	setAutoFreeze,
	enableAllPlugins,
	current,
	immerable,
	isDraft,
	produce,
	original
} from "../src/immer"

enableAllPlugins()

runTests("proxy", true)
runTests("es5", false)

function runTests(name, useProxies) {
	describe("current - " + name, () => {
		beforeAll(() => {
			setAutoFreeze(true)
			setUseProxies(useProxies)
		})

		it("must be called on draft", () => {
			expect(() => {
				current({})
			}).toThrowError("[Immer] 'current' expects a draft, got: [object Object]")
		})

		it("can handle simple arrays", () => {
			const base = [{x: 1}]
			let c
			const next = produce(base, draft => {
				expect(current(draft)).toEqual(base)
				draft[0].x++
				c = current(draft)
				expect(c).toEqual([{x: 2}])
				expect(Array.isArray(c))
				draft[0].x++
			})
			expect(next).toEqual([{x: 3}])
			expect(c).toEqual([{x: 2}])
			expect(isDraft(c)).toBe(false)
		})

		it("won't freeze", () => {
			const base = {x: 1}
			const next = produce(base, draft => {
				draft.x++
				expect(Object.isFrozen(current(draft))).toBe(false)
			})
		})

		it("returns original without changes", () => {
			const base = {}
			produce(base, draft => {
				expect(original(draft)).toBe(base)
				expect(current(draft)).toBe(base)
			})
		})

		it("can handle property additions", () => {
			const base = {}
			produce(base, draft => {
				draft.x = true
				const c = current(draft)
				expect(c).not.toBe(base)
				expect(c).not.toBe(draft)
				expect(c).toEqual({
					x: true
				})
			})
		})

		it("can handle property deletions", () => {
			const base = {
				x: 1
			}
			produce(base, draft => {
				delete draft.x
				const c = current(draft)
				expect(c).not.toBe(base)
				expect(c).not.toBe(draft)
				expect(c).toEqual({})
			})
		})

		it("won't reflect changes over time", () => {
			const base = {
				x: 1
			}
			produce(base, draft => {
				draft.x++
				const c = current(draft)
				expect(c).toEqual({
					x: 2
				})
				draft.x++
				expect(c).toEqual({
					x: 2
				})
			})
		})

		it("will find drafts inside objects", () => {
			const base = {
				x: 1,
				y: {
					z: 2
				},
				z: {}
			}
			produce(base, draft => {
				draft.y.z++
				draft.y = {
					nested: draft.y
				}
				const c = current(draft)
				expect(c).toEqual({
					x: 1,
					y: {
						nested: {
							z: 3
						}
					},
					z: {}
				})
				expect(isDraft(c.y.nested)).toBe(false)
				expect(c.z).toBe(base.z)
				expect(c.y.nested).not.toBe(draft.y.nested)
			})
		})

		it("handles map - 1", () => {
			const base = new Map([["a", {x: 1}]])
			produce(base, draft => {
				expect(current(draft)).toBe(base)
				draft.delete("a")
				let c = current(draft)
				expect(current(draft)).not.toBe(base)
				expect(current(draft)).not.toBe(draft)
				expect(c).toEqual(new Map())
				const obj = {}
				draft.set("b", obj)
				expect(c).toEqual(new Map())
				expect(current(draft)).toEqual(new Map([["b", obj]]))
				expect(c).toBeInstanceOf(Map)
			})
		})

		it("handles map - 2", () => {
			const base = new Map([["a", {x: 1}]])
			produce(base, draft => {
				draft.get("a").x++
				const c = current(draft)
				expect(c).not.toBe(base)
				expect(c).toEqual(new Map([["a", {x: 2}]]))
				draft.get("a").x++
				expect(c).toEqual(new Map([["a", {x: 2}]]))
			})
		})

		it("handles set", () => {
			const base = new Set([1])
			produce(base, draft => {
				expect(current(draft)).toBe(base)
				draft.add(2)
				const c = current(draft)
				expect(c).toEqual(new Set([1, 2]))
				expect(c).not.toBe(draft)
				expect(c).not.toBe(base)
				draft.add(3)
				expect(c).toEqual(new Set([1, 2]))
				expect(c).toBeInstanceOf(Set)
			})
		})

		it("handles simple class", () => {
			class Counter {
				[immerable] = true
				current = 0

				inc() {
					this.current++
				}
			}

			const counter1 = new Counter()
			produce(counter1, draft => {
				expect(current(draft)).toBe(counter1)
				draft.inc()
				const c = current(draft)
				expect(c).not.toBe(draft)
				expect(c.current).toBe(1)
				c.inc()
				expect(c.current).toBe(2)
				expect(draft.current).toBe(1)
				draft.inc()
				draft.inc()
				expect(c.current).toBe(2)
				expect(draft.current).toBe(3)
				expect(c).toBeInstanceOf(Counter)
			})
		})
	})
}
