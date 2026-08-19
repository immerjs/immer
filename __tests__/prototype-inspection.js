"use strict"
import {produce, immerable} from "../src/immer"

// Ecosystem libraries introspect prototypes to classify values, and reducers
// routinely run them against drafts. The patterns below are lifted from the
// most-installed consumers so drafts stay safe for them:
// - lodash `isPrototype` (used by _.isEmpty, _.isEqual, _.isPlainObject):
//   reads `value.constructor.prototype`
// - fast-deep-equal: compares `a.constructor !== b.constructor`
// These once crashed or misreported on drafts (#1265, #1266, #1268) because a
// guard wrapped `constructor` reads in a Proxy, violating the engine invariant
// for Object's non-configurable `prototype` property. The guard was reverted
// in #1271; these tests pin the restored behavior.
function isPrototype(value) {
	const Ctor = value && value.constructor
	const proto =
		(typeof Ctor == "function" && Ctor.prototype) || Object.prototype
	return value === proto
}

describe("prototype inspection", () => {
	it("returns the real constructor for object and array drafts", () => {
		produce({a: {}, b: []}, draft => {
			expect(draft.constructor).toBe(Object)
			expect(draft.a.constructor).toBe(Object)
			expect(draft.b.constructor).toBe(Array)
		})
	})

	it("returns the real constructor for class drafts", () => {
		class Todo {
			[immerable] = true
			title = "test"
		}
		produce(new Todo(), draft => {
			expect(draft.constructor).toBe(Todo)
		})
	})

	it("keeps constructor identity stable across drafts - #1266", () => {
		produce({a: {}, b: {}}, draft => {
			expect(draft.a.constructor).toBe(draft.b.constructor)
			expect(draft.a.constructor !== draft.b.constructor).toBe(false)
		})
	})

	it("allows reading constructor.prototype - #1265, #1268", () => {
		produce({}, draft => {
			expect(() => draft.constructor.prototype).not.toThrow()
			expect(draft.constructor.prototype).toBe(Object.prototype)
		})
	})

	it("supports lodash's isPrototype idiom on drafts - #1268", () => {
		produce({items: [{done: false}]}, draft => {
			expect(() => isPrototype(draft)).not.toThrow()
			expect(isPrototype(draft)).toBe(false)
			expect(isPrototype(draft.items)).toBe(false)
			expect(isPrototype(draft.items[0])).toBe(false)
		})
	})

	it("reports reserved names through `in` and Object.keys", () => {
		produce({a: 1}, draft => {
			expect("constructor" in draft).toBe(true)
			expect(Object.keys(draft)).toEqual(["a"])
		})
	})

	it("round-trips own data keys named like reserved properties", () => {
		const base = {constructor: "not a function"}
		produce(base, draft => {
			expect(draft.constructor).toBe("not a function")
		})
		const result = produce({}, draft => {
			draft.prototype = 42
		})
		expect(result.prototype).toBe(42)
	})

	it("returns the real prototype for __proto__ reads", () => {
		produce({}, draft => {
			expect(Object.getPrototypeOf(draft)).toBe(Object.prototype)
			expect(draft.__proto__).toBe(Object.prototype)
		})
	})

	it("still forbids setPrototypeOf on drafts", () => {
		produce({}, draft => {
			expect(() => Object.setPrototypeOf(draft, {})).toThrow()
		})
	})
})
