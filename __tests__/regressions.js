"use strict"
import {
	Immer,
	nothing,
	original,
	isDraft,
	immerable,
	enableAllPlugins
} from "../src/immer"

enableAllPlugins()

runBaseTest("proxy (no freeze)", true, false)
runBaseTest("proxy (autofreeze)", true, true)
runBaseTest("es5 (no freeze)", false, false)
runBaseTest("es5 (autofreeze)", false, true)

function runBaseTest(name, useProxies, autoFreeze, useListener) {
	const listener = useListener ? function() {} : undefined
	const {produce, produceWithPatches} = createPatchedImmer({
		useProxies,
		autoFreeze
	})

	// When `useListener` is true, append a function to the arguments of every
	// uncurried `produce` call in every test. This makes tests easier to read.
	function createPatchedImmer(options) {
		const immer = new Immer(options)

		const {produce} = immer
		immer.produce = function(...args) {
			return typeof args[1] === "function" && args.length < 3
				? produce(...args, listener)
				: produce(...args)
		}

		return immer
	}

	describe(`regressions ${name}`, () => {
		test("#604 freeze inside class", () => {
			class Thing {
				[immerable] = true

				constructor({x}) {
					this._data = {x}
				}

				get x() {
					return this._data.x
				}

				set x(x) {
					this._data.x = x
				}
			}

			let i = 1
			let item = new Thing({x: i})
			let item0 = item

			const bump = () => {
				item = produce(item, draft => {
					// uncomment this to make things work
					//draft._data
					draft.x = ++i
				})
			}

			bump()
			bump()

			expect(i).toBe(3)
			expect(item._data).toEqual({
				x: 3
			})
			expect(item0._data).toEqual({
				x: 1
			})
		})

		test("#646 setting undefined field to undefined should not create new result", () => {
			const foo = {
				bar: undefined
			}
			const foo2 = produce(foo, draft => {
				draft.bar = undefined
			})
			expect(foo2).toBe(foo)
		})

		test("#646 - 2 setting undefined field to undefined should not create new result", () => {
			const foo = {}
			const foo2 = produce(foo, draft => {
				draft.bar = undefined
			})
			expect(foo2).not.toBe(foo)
			expect(foo).toEqual({})
			expect(foo2).toEqual({bar: undefined})
		})

		test("#638 - out of range assignments", () => {
			const state = []

			const state1 = produce(state, draft => {
				draft[2] = "v2"
			})

			expect(state1.length).toBe(3)
			expect(state1).toEqual([undefined, undefined, "v2"])

			const state2 = produce(state1, draft => {
				draft[1] = "v1"
			})

			expect(state2.length).toBe(3)
			expect(state2).toEqual([undefined, "v1", "v2"])
		})

		test("#628 set removal hangs", () => {
			let arr = []
			let set = new Set([arr])

			let result = produce(set, draft1 => {
				produce(draft1, draft2 => {
					draft2.delete(arr)
				})
			})
			expect(result).toEqual(new Set([[]])) // N.B. this outcome doesn't seem not correct, but then again,
			// double produce without return looks iffy as well, so not sure what the expected outcome in the
			// original report was
		})

		test("#628 - 2 set removal hangs", () => {
			let arr = []
			let set = new Set([arr])

			let result = produce(set, draft2 => {
				draft2.delete(arr)
			})
			expect(result).toEqual(new Set())
		})

		test("#650 - changes with overridden arr.slice() fail", () => {
			const data = {
				foo: [
					{
						isActive: false
					}
				]
			}
			// That's roughly what seamless-immutable does
			data.foo.slice = (...args) =>
				Object.freeze(Array.prototype.slice.call(data.foo, ...args))

			const newData = produce(data, draft => {
				draft.foo[0].isActive = true
			})
			expect(newData.foo[0].isActive).toBe(true)
		})

		test("#659 no reconciliation after read", () => {
			const bar = {}
			const foo = {bar}

			const next = produce(foo, draft => {
				draft.bar
				draft.bar = bar
			})
			expect(next).toBe(foo)
		})

		test("#659 no reconciliation after read - 2", () => {
			const bar = {}
			const foo = {bar}

			const next = produce(foo, draft => {
				const subDraft = draft.bar
				draft.bar = bar
				subDraft.x = 3 // this subDraft is not part of the end result, so ignore
			})

			expect(next).toEqual(foo)
		})

		test("#659 no reconciliation after read - 3", () => {
			const bar = {}
			const foo = {bar}

			const next = produce(foo, draft => {
				const subDraft = draft.bar
				subDraft.x = 3 // this subDraft is not part of the end result, so ignore
				draft.bar = bar
			})
			expect(next).toEqual(foo)
		})

		// Disabled: these are optimizations that would be nice if they
		// could be detected, but don't change the correctness of the result
		test.skip("#659 no reconciliation after read - 4", () => {
			const bar = {}
			const foo = {bar}

			const next = produce(foo, draft => {
				const subDraft = draft.bar
				draft.bar = bar
				subDraft.x = 3 // this subDraft is not part of the end result, so ignore
			})

			expect(next).toBe(foo)
		})

		// Disabled: these are optimizations that would be nice if they
		// could be detected, but don't change the correctness of the result
		test.skip("#659 no reconciliation after read - 5", () => {
			const bar = {}
			const foo = {bar}

			const next = produce(foo, draft => {
				const subDraft = draft.bar
				subDraft.x = 3 // this subDraft is not part of the end result, so ignore
				draft.bar = bar
			})
			expect(next).toBe(foo)
		})

		test("#659 no reconciliation after read - 6", () => {
			const bar = {}
			const foo = {bar}

			const next = produce(foo, draft => {
				const subDraft = draft.bar
				subDraft.x = 3 // this subDraft is not part of the end result, so ignore
				draft.bar = bar
				draft.bar = subDraft
			})
			expect(next).not.toBe(foo)
			expect(next).toEqual({
				bar: {x: 3}
			})
		})
	})
}
