import {vi} from "vitest"
import {
	Immer,
	setAutoFreeze,
	current,
	immerable,
	isDraft,
	produce,
	original,
	freeze,
	enableMapSet
} from "../src/immer"

enableMapSet()

runTests("proxy", true)

const isProd = process.env.NODE_ENV === "production"

function runTests(name) {
	describe("current - " + name, () => {
		beforeAll(() => {
			setAutoFreeze(true)
		})

		it("must be called on draft", () => {
			expect(() => {
				current({})
			}).toThrowError(
				isProd
					? "[Immer] minified error nr: 10. Full error at: https://bit.ly/3cXEKWf"
					: "[Immer] 'current' expects a draft, got: [object Object]"
			)
		})

		it("can handle simple arrays", () => {
			const base = [{x: 1}]
			let c
			const next = produce(base, draft => {
				expect(current(draft)).toEqual(base)
				draft[0].x++
				c = current(draft)
				expect(c).toEqual([{x: 2}])
				expect(Array.isArray(c)).toBe(true)
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
				z: {},
				w: {},
				ww: freeze({})
			}
			produce(base, draft => {
				draft.y.z++
				draft.z = {
					nested: {
						z: 3
					}
				}
				const c = current(draft)
				expect(c).toEqual({
					x: 1,
					y: {
						z: 3
					},
					z: {nested: {z: 3}},
					w: {},
					ww: {}
				})
				expect(isDraft(c)).toBe(false)
				expect(isDraft(c.y)).toBe(false)
				expect(isDraft(c.z)).toBe(false)
				expect(isDraft(c.z.nested)).toBe(false)
				expect(isDraft(c.z.nested.z)).toBe(false)
				// this works only with frozen objects, otherwise no way to tell if this was
				// a new object that was added during the recipe, that might contain drafts.
				// the recipe or not
				expect(c.w).not.toBe(base.w)
				// was frozen, so recyclable
				expect(c.ww).toBe(base.ww)
			})
		})

		it("will find drafts inside objects - 2", () => {
			const base = {
				ar: [
					{
						x: 1
					},
					{x: 2}
				]
			}
			produce(base, draft => {
				draft.ar[1].x++
				draft.ar = [draft.ar[1], draft.ar[0]] // swap
				const c = current(draft)
				expect(c).toEqual({
					ar: [{x: 3}, {x: 1}]
				})
				expect(isDraft(c)).toBe(false)
				expect(isDraft(c.ar)).toBe(false)
				expect(isDraft(c.ar[0])).toBe(false)
				expect(isDraft(c.ar[1])).toBe(false)
				expect(c.ar[1]).toBe(base.ar[0])
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

// Bound Set traversal so a regression cannot hang the test process.
function takeSetSnapshot(draft) {
	const forEach = Set.prototype.forEach
	const guard = vi
		.spyOn(Set.prototype, "forEach")
		.mockImplementation(function (callback, thisArg) {
			const size = this.size
			let visited = 0
			return forEach.call(this, (value, key, set) => {
				if (++visited > size)
					throw new Error("Set snapshot traversal grew beyond its initial size")
				callback.call(thisArg, value, key, set)
			})
		})
	try {
		return current(draft)
	} finally {
		guard.mockRestore()
	}
}

describe.each([true, false])(
	"current Set snapshots - autoFreeze=%s",
	autoFreeze => {
		const {produce} = new Immer({autoFreeze})

		it("snapshots modified objects in insertion order without leaking drafts", () => {
			const changed = {count: 0}
			const untouched = {count: 10}
			const base = new Set([changed, "middle", untouched])
			let snapshot
			const next = produce(base, draft => {
				const item = draft.values().next().value
				item.count = 1
				snapshot = takeSetSnapshot(draft)
				const values = [...snapshot]
				expect(values).toEqual([{count: 1}, "middle", untouched])
				expect(values[2]).toBe(untouched)
				expect(values.every(value => !isDraft(value))).toBe(true)
				expect(Object.isFrozen(snapshot)).toBe(false)
				expect(Object.isFrozen(values[0])).toBe(false)
				item.count = 2
				expect(values[0].count).toBe(1)
			})
			expect([...snapshot]).toEqual([{count: 1}, "middle", untouched])
			expect([...next]).toEqual([{count: 2}, "middle", untouched])
			expect(changed.count).toBe(0)
		})

		it("snapshots object Sets nested in a parent", () => {
			const base = {items: new Set([{count: 0}])}
			let snapshot
			const next = produce(base, draft => {
				const item = draft.items.values().next().value
				item.count = 1
				snapshot = takeSetSnapshot(draft)
				item.count = 2
			})
			expect([...snapshot.items]).toEqual([{count: 1}])
			expect([...next.items]).toEqual([{count: 2}])
			expect([...base.items]).toEqual([{count: 0}])
		})

		it("keeps membership snapshots independent of later additions and deletions", () => {
			const removed = {id: "removed"}
			const kept = {id: "kept"}
			const base = new Set([removed, kept])
			let snapshot
			const next = produce(base, draft => {
				draft.delete(removed)
				draft.add({id: "added"})
				snapshot = takeSetSnapshot(draft)
				expect([...snapshot]).toEqual([kept, {id: "added"}])
				expect([...snapshot][0]).toBe(kept)
				draft.clear()
			})
			expect([...snapshot]).toEqual([kept, {id: "added"}])
			expect(next.size).toBe(0)
			expect([...base]).toEqual([removed, kept])
		})

		it("snapshots arrays stored as Set values", () => {
			const base = new Set([[1]])
			let snapshot
			produce(base, draft => {
				const item = draft.values().next().value
				item.push(2)
				snapshot = takeSetSnapshot(draft)
				item.push(3)
			})
			expect([...snapshot]).toEqual([[1, 2]])
			expect([...base]).toEqual([[1]])
		})

		it("keeps unchanged frozen objects exactly once when adding a primitive", () => {
			const item = freeze({count: 0})
			const base = new Set([item])
			let snapshot
			produce(base, draft => {
				draft.add(1)
				snapshot = takeSetSnapshot(draft)
			})
			expect([...snapshot]).toEqual([item, 1])
			expect([...snapshot][0]).toBe(item)
		})

		it("returns the original Set when its objects are only read", () => {
			const base = new Set([{count: 0}])
			produce(base, draft => {
				expect(draft.values().next().value.count).toBe(0)
				expect(takeSetSnapshot(draft)).toBe(base)
			})
		})
	}
)
