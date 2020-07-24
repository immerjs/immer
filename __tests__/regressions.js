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
	})
}
