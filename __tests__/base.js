"use strict"
import {
	Immer,
	nothing,
	original,
	isDraft,
	immerable,
	enableAllPlugins
} from "../src/immer"
import {each, shallowCopy, DRAFT_STATE} from "../src/internal"
import deepFreeze from "deep-freeze"
import cloneDeep from "lodash.clonedeep"
import * as lodash from "lodash"

jest.setTimeout(1000)

enableAllPlugins()

test("immer should have no dependencies", () => {
	expect(require("../package.json").dependencies).toBeUndefined()
})

runBaseTest("proxy (no freeze)", true, false)
runBaseTest("proxy (autofreeze)", true, true)
runBaseTest("proxy (patch listener)", true, false, true)
runBaseTest("proxy (autofreeze)(patch listener)", true, true, true)

runBaseTest("es5 (no freeze)", false, false)
runBaseTest("es5 (autofreeze)", false, true)
runBaseTest("es5 (patch listener)", false, false, true)
runBaseTest("es5 (autofreeze)(patch listener)", false, true, true)

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

	describe(`base functionality - ${name}`, () => {
		let baseState
		let origBaseState

		beforeEach(() => {
			origBaseState = baseState = createBaseState()
		})

		it("returns the original state when no changes are made", () => {
			const nextState = produce(baseState, s => {
				expect(s.aProp).toBe("hi")
				expect(s.anObject.nested).toMatchObject({yummie: true})
			})
			expect(nextState).toBe(baseState)
		})

		it("does structural sharing", () => {
			const random = Math.random()
			const nextState = produce(baseState, s => {
				s.aProp = random
			})
			expect(nextState).not.toBe(baseState)
			expect(nextState.aProp).toBe(random)
			expect(nextState.nested).toBe(baseState.nested)
		})

		it("deep change bubbles up", () => {
			const nextState = produce(baseState, s => {
				s.anObject.nested.yummie = false
			})
			expect(nextState).not.toBe(baseState)
			expect(nextState.anObject).not.toBe(baseState.anObject)
			expect(baseState.anObject.nested.yummie).toBe(true)
			expect(nextState.anObject.nested.yummie).toBe(false)
			expect(nextState.anArray).toBe(baseState.anArray)
		})

		it("can add props", () => {
			const nextState = produce(baseState, s => {
				s.anObject.cookie = {tasty: true}
			})
			expect(nextState).not.toBe(baseState)
			expect(nextState.anObject).not.toBe(baseState.anObject)
			expect(nextState.anObject.nested).toBe(baseState.anObject.nested)
			expect(nextState.anObject.cookie).toEqual({tasty: true})
		})

		it("can delete props", () => {
			const nextState = produce(baseState, s => {
				delete s.anObject.nested
			})
			expect(nextState).not.toBe(baseState)
			expect(nextState.anObject).not.toBe(baseState.anObject)
			expect(nextState.anObject.nested).toBe(undefined)
		})

		// Found by: https://github.com/mweststrate/immer/pull/267
		it("can delete props added in the producer", () => {
			const nextState = produce(baseState, s => {
				s.anObject.test = true
				delete s.anObject.test
			})
			if (useProxies) {
				expect(nextState).not.toBe(baseState)
				expect(nextState).toEqual(baseState)
			} else {
				// The copy is avoided in ES5.
				expect(nextState).toBe(baseState)
			}
		})

		// Found by: https://github.com/mweststrate/immer/issues/328
		it("can set a property that was just deleted", () => {
			const baseState = {a: 1}
			const nextState = produce(baseState, s => {
				delete s.a
				s.a = 2
			})
			expect(nextState.a).toBe(2)
		})

		it("can set a property to its original value after deleting it", () => {
			const baseState = {a: {b: 1}}
			const nextState = produce(baseState, s => {
				const a = s.a
				delete s.a
				s.a = a
			})
			if (useProxies) {
				expect(nextState).not.toBe(baseState)
				expect(nextState).toEqual(baseState)
			} else {
				// The copy is avoided in ES5.
				expect(nextState).toBe(baseState)
			}
		})

		it("can get property descriptors", () => {
			const getDescriptor = Object.getOwnPropertyDescriptor
			const baseState = deepFreeze([{a: 1}])
			produce(baseState, arr => {
				const obj = arr[0]
				const desc = {
					configurable: true,
					enumerable: true,
					...(useProxies && {writable: true})
				}

				// Known property
				expect(getDescriptor(obj, "a")).toMatchObject(desc)
				expect(getDescriptor(arr, 0)).toMatchObject(desc)

				// Deleted property
				delete obj.a
				arr.pop()
				expect(getDescriptor(obj, "a")).toBeUndefined()
				expect(getDescriptor(arr, 0)).toBeUndefined()

				// Unknown property
				expect(getDescriptor(obj, "b")).toBeUndefined()
				expect(getDescriptor(arr, 100)).toBeUndefined()

				// Added property
				obj.b = 2
				arr[100] = 1
				expect(getDescriptor(obj, "b")).toBeDefined()
				expect(getDescriptor(arr, 100)).toBeDefined()
			})
		})

		describe("array drafts", () => {
			it("supports Array.isArray()", () => {
				const nextState = produce(baseState, s => {
					expect(Array.isArray(s.anArray)).toBeTruthy()
					s.anArray.push(1)
				})
				expect(Array.isArray(nextState.anArray)).toBeTruthy()
			})

			it("supports index access", () => {
				const value = baseState.anArray[0]
				const nextState = produce(baseState, s => {
					expect(s.anArray[0]).toBe(value)
				})
				expect(nextState).toBe(baseState)
			})

			it("supports iteration", () => {
				const base = [
					{id: 1, a: 1},
					{id: 2, a: 1}
				]
				const findById = (collection, id) => {
					for (const item of collection) {
						if (item.id === id) return item
					}
					return null
				}
				const result = produce(base, draft => {
					const obj1 = findById(draft, 1)
					const obj2 = findById(draft, 2)
					obj1.a = 2
					obj2.a = 2
				})
				expect(result[0].a).toEqual(2)
				expect(result[1].a).toEqual(2)
			})

			it("can assign an index via bracket notation", () => {
				const nextState = produce(baseState, s => {
					s.anArray[3] = true
				})
				expect(nextState).not.toBe(baseState)
				expect(nextState.anArray).not.toBe(baseState.anArray)
				expect(nextState.anArray[3]).toEqual(true)
			})

			it("can use splice() to both add and remove items", () => {
				const nextState = produce(baseState, s => {
					s.anArray.splice(1, 1, "a", "b")
				})
				expect(nextState.anArray).not.toBe(baseState.anArray)
				expect(nextState.anArray[1]).toBe("a")
				expect(nextState.anArray[2]).toBe("b")
			})

			it("can truncate via the length property", () => {
				const baseLength = baseState.anArray.length
				const nextState = produce(baseState, s => {
					s.anArray.length = baseLength - 1
				})
				expect(nextState.anArray).not.toBe(baseState.anArray)
				expect(nextState.anArray.length).toBe(baseLength - 1)
			})

			it("can extend via the length property", () => {
				const baseLength = baseState.anArray.length
				const nextState = produce(baseState, s => {
					s.anArray.length = baseLength + 1
				})
				expect(nextState.anArray).not.toBe(baseState.anArray)
				expect(nextState.anArray.length).toBe(baseLength + 1)
			})

			// Reported here: https://github.com/mweststrate/immer/issues/116
			it("can pop then push", () => {
				const nextState = produce([1, 2, 3], s => {
					s.pop()
					s.push(100)
				})
				expect(nextState).toEqual([1, 2, 100])
			})

			it("can be sorted", () => {
				const baseState = [3, 1, 2]
				const nextState = produce(baseState, s => {
					s.sort()
				})
				expect(nextState).not.toBe(baseState)
				expect(nextState).toEqual([1, 2, 3])
			})

			it("supports modifying nested objects", () => {
				const baseState = [{a: 1}, {}]
				const nextState = produce(baseState, s => {
					s[0].a++
					s[1].a = 0
				})
				expect(nextState).not.toBe(baseState)
				expect(nextState[0].a).toBe(2)
				expect(nextState[1].a).toBe(0)
			})

			it("never preserves non-numeric properties", () => {
				const baseState = []
				baseState.x = 7
				const nextState = produce(baseState, s => {
					s.push(3)
				})
				expect("x" in nextState).toBeFalsy()
			})

			if (useProxies && !global.USES_BUILD) {
				it("throws when a non-numeric property is added", () => {
					expect(() => {
						produce([], d => {
							d.x = 3
						})
					}).toThrowErrorMatchingSnapshot()
				})

				it("throws when a non-numeric property is deleted", () => {
					expect(() => {
						const baseState = []
						baseState.x = 7
						produce(baseState, d => {
							delete d.x
						})
					}).toThrowErrorMatchingSnapshot()
				})
			}
		})

		describe("map drafts", () => {
			it("supports key access", () => {
				const value = baseState.aMap.get("jedi")
				const nextState = produce(baseState, s => {
					expect(s.aMap.get("jedi")).toEqual(value)
				})
				expect(nextState).toBe(baseState)
			})

			it("supports key access for non-primitive keys", () => {
				const key = {prop: "val"}
				const base = new Map([[key, {id: 1, a: 1}]])
				const value = base.get(key)
				const nextState = produce(base, s => {
					expect(s.get(key)).toEqual(value)
				})
				expect(nextState).toBe(base)
			})

			it("supports iteration", () => {
				const base = new Map([
					["first", {id: 1, a: 1}],
					["second", {id: 2, a: 1}]
				])
				const findById = (map, id) => {
					for (const [, item] of map) {
						if (item.id === id) return item
					}
					return null
				}
				const result = produce(base, draft => {
					const obj1 = findById(draft, 1)
					const obj2 = findById(draft, 2)
					obj1.a = 2
					obj2.a = 2
				})
				expect(result).not.toBe(base)
				expect(result.get("first").a).toEqual(2)
				expect(result.get("second").a).toEqual(2)
			})

			it("supports 'entries'", () => {
				const base = new Map([
					["first", {id: 1, a: 1}],
					["second", {id: 2, a: 1}]
				])
				const findById = (map, id) => {
					for (const [, item] of map.entries()) {
						if (item.id === id) return item
					}
					return null
				}
				const result = produce(base, draft => {
					const obj1 = findById(draft, 1)
					const obj2 = findById(draft, 2)
					obj1.a = 2
					obj2.a = 2
				})
				expect(result).not.toBe(base)
				expect(result.get("first").a).toEqual(2)
				expect(result.get("second").a).toEqual(2)
			})

			it("supports 'values'", () => {
				const base = new Map([
					["first", {id: 1, a: 1}],
					["second", {id: 2, a: 1}]
				])
				const findById = (map, id) => {
					for (const item of map.values()) {
						if (item.id === id) return item
					}
					return null
				}
				const result = produce(base, draft => {
					const obj1 = findById(draft, 1)
					const obj2 = findById(draft, 2)
					obj1.a = 2
					obj2.a = 2
				})
				expect(result).not.toBe(base)
				expect(result.get("first").a).toEqual(2)
				expect(result.get("second").a).toEqual(2)
			})

			it("supports 'keys", () => {
				const base = new Map([
					["first", Symbol()],
					["second", Symbol()]
				])
				const result = produce(base, draft => {
					expect([...draft.keys()]).toEqual(["first", "second"])
					draft.set("third", Symbol())
					expect([...draft.keys()]).toEqual(["first", "second", "third"])
				})
			})

			it("supports forEach", () => {
				const key1 = {prop: "val1"}
				const key2 = {prop: "val2"}
				const base = new Map([
					["first", {id: 1, a: 1}],
					["second", {id: 2, a: 1}],
					[key1, {id: 3, a: 1}],
					[key2, {id: 4, a: 1}]
				])
				const result = produce(base, draft => {
					let sum1 = 0
					draft.forEach(({a}) => {
						sum1 += a
					})
					expect(sum1).toBe(4)
					let sum2 = 0
					draft.get("first").a = 10
					draft.get("second").a = 20
					draft.get(key1).a = 30
					draft.get(key2).a = 40
					draft.forEach(({a}) => {
						sum2 += a
					})
					expect(sum2).toBe(100)
				})
				expect(result).not.toBe(base)
				expect(base.get("first").a).toEqual(1)
				expect(base.get("second").a).toEqual(1)
				expect(base.get(key1).a).toEqual(1)
				expect(base.get(key2).a).toEqual(1)
				expect(result.get("first").a).toEqual(10)
				expect(result.get("second").a).toEqual(20)
				expect(result.get(key1).a).toEqual(30)
				expect(result.get(key2).a).toEqual(40)
			})

			it("supports forEach mutation", () => {
				const base = new Map([
					["first", {id: 1, a: 1}],
					["second", {id: 2, a: 1}]
				])
				const result = produce(base, draft => {
					draft.forEach(item => {
						item.a = 100
					})
				})
				expect(result).not.toBe(base)
				expect(result.get("first").a).toEqual(100)
				expect(result.get("second").a).toEqual(100)
			})

			it("can assign by key", () => {
				const nextState = produce(baseState, s => {
					// Map.prototype.set should return the Map itself
					const res = s.aMap.set("force", true)
					if (!global.USES_BUILD) expect(res).toBe(s.aMap[DRAFT_STATE].draft_)
				})
				expect(nextState).not.toBe(baseState)
				expect(nextState.aMap).not.toBe(baseState.aMap)
				expect(nextState.aMap.get("force")).toEqual(true)
			})

			it("can assign by a non-primitive key", () => {
				const key = {prop: "val"}
				const value = {id: 1, a: 1}
				const base = new Map([[key, value]])
				const nextState = produce(base, s => {
					s.set(key, true)
				})
				expect(nextState).not.toBe(base)
				expect(base.get(key)).toEqual(value)
				expect(nextState.get(key)).toEqual(true)
			})

			it("state stays the same if the the same item is assigned by key", () => {
				const nextState = produce(baseState, s => {
					s.aMap.set("jediTotal", 42)
				})
				expect(nextState).toBe(baseState)
				expect(nextState.aMap).toBe(baseState.aMap)
			})

			it("returns 'size'", () => {
				const nextState = produce(baseState, s => {
					s.aMap.set("newKey", true)
					expect(s.aMap.size).toBe(baseState.aMap.size + 1)
				})
				expect(nextState).not.toBe(baseState)
				expect(nextState.aMap).not.toBe(baseState.aMap)
				expect(nextState.aMap.get("newKey")).toEqual(true)
				expect(nextState.aMap.size).toEqual(baseState.aMap.size + 1)
			})

			it("can use 'delete' to remove items", () => {
				const nextState = produce(baseState, s => {
					expect(s.aMap.has("jedi")).toBe(true)
					expect(s.aMap.delete("jedi")).toBe(true)
					expect(s.aMap.has("jedi")).toBe(false)
				})
				expect(nextState.aMap).not.toBe(baseState.aMap)
				expect(nextState.aMap.size).toBe(baseState.aMap.size - 1)
				expect(baseState.aMap.has("jedi")).toBe(true)
				expect(nextState.aMap.has("jedi")).toBe(false)
			})

			it("can use 'clear' to remove items", () => {
				const nextState = produce(baseState, s => {
					expect(s.aMap.size).not.toBe(0)
					s.aMap.clear()
					expect(s.aMap.size).toBe(0)
				})
				expect(nextState.aMap).not.toBe(baseState.aMap)
				expect(baseState.aMap.size).not.toBe(0)
				expect(nextState.aMap.size).toBe(0)
			})

			it("support 'has'", () => {
				const nextState = produce(baseState, s => {
					expect(s.aMap.has("newKey")).toBe(false)
					s.aMap.set("newKey", true)
					expect(s.aMap.has("newKey")).toBe(true)
				})
				expect(nextState).not.toBe(baseState)
				expect(nextState.aMap).not.toBe(baseState.aMap)
				expect(baseState.aMap.has("newKey")).toBe(false)
				expect(nextState.aMap.has("newKey")).toBe(true)
			})

			it("supports nested maps", () => {
				const base = new Map([["first", new Map([["second", {prop: "test"}]])]])
				const result = produce(base, draft => {
					draft.get("first").get("second").prop = "test1"
				})
				expect(result).not.toBe(base)
				expect(result.get("first")).not.toBe(base.get("first"))
				expect(result.get("first").get("second")).not.toBe(
					base.get("first").get("second")
				)
				expect(base.get("first").get("second").prop).toBe("test")
				expect(result.get("first").get("second").prop).toBe("test1")
			})

			it("treats void deletes as no-op", () => {
				const base = new Map([["x", 1]])
				const next = produce(base, d => {
					expect(d.delete("y")).toBe(false)
				})
				expect(next).toBe(base)
			})

			it("revokes map proxies", () => {
				let m
				produce(baseState, s => {
					m = s.aMap
				})
				expect(() => m.get("x")).toThrowErrorMatchingSnapshot()
				expect(() => m.set("x", 3)).toThrowErrorMatchingSnapshot()
			})

			it("does not draft map keys", () => {
				// anything else would be terribly confusing
				const key = {a: 1}
				const map = new Map([[key, 2]])
				const next = produce(map, d => {
					const dKey = Array.from(d.keys())[0]
					expect(isDraft(dKey)).toBe(false)
					expect(dKey).toBe(key)
					dKey.a += 1
					d.set(dKey, d.get(dKey) + 1)
					d.set(key, d.get(key) + 1)
					expect(d.get(key)).toBe(4)
					expect(key.a).toBe(2)
				})
				const entries = Array.from(next.entries())
				expect(entries).toEqual([[key, 4]])
				expect(entries[0][0]).toBe(key)
				expect(entries[0][0].a).toBe(2)
			})

			it("does support instanceof Map", () => {
				const map = new Map()
				produce(map, d => {
					expect(d instanceof Map).toBeTruthy()
				})
			})

			it("handles clear correctly", () => {
				const map = new Map([
					["a", 1],
					["c", 3]
				])
				const next = produce(map, draft => {
					draft.delete("a")
					draft.set("b", 2)
					draft.set("c", 4)
					draft.clear()
				})
				expect(next).toEqual(new Map())
			})
		})

		describe("set drafts", () => {
			it("supports iteration", () => {
				const base = new Set([
					{id: 1, a: 1},
					{id: 2, a: 1}
				])
				const findById = (set, id) => {
					for (const item of set) {
						if (item.id === id) return item
					}
					return null
				}
				const result = produce(base, draft => {
					const obj1 = findById(draft, 1)
					const obj2 = findById(draft, 2)
					obj1.a = 2
					obj2.a = 2
				})
				expect(result).not.toBe(base)
				expect(base).toEqual(
					new Set([
						{id: 1, a: 1},
						{id: 2, a: 1}
					])
				)
				expect(result).toEqual(
					new Set([
						{id: 1, a: 2},
						{id: 2, a: 2}
					])
				)
			})

			it("supports 'entries'", () => {
				const base = new Set([
					{id: 1, a: 1},
					{id: 2, a: 1}
				])
				const findById = (set, id) => {
					for (const [item1, item2] of set.entries()) {
						expect(item1).toBe(item2)
						if (item1.id === id) return item1
					}
					return null
				}
				const result = produce(base, draft => {
					const obj1 = findById(draft, 1)
					const obj2 = findById(draft, 2)
					obj1.a = 2
					obj2.a = 2
				})
				expect(result).not.toBe(base)
				expect(base).toEqual(
					new Set([
						{id: 1, a: 1},
						{id: 2, a: 1}
					])
				)
				expect(result).toEqual(
					new Set([
						{id: 1, a: 2},
						{id: 2, a: 2}
					])
				)
			})

			it("supports 'values'", () => {
				const base = new Set([
					{id: 1, a: 1},
					{id: 2, a: 1}
				])
				const findById = (set, id) => {
					for (const item of set.values()) {
						if (item.id === id) return item
					}
					return null
				}
				const result = produce(base, draft => {
					const obj1 = findById(draft, 1)
					const obj2 = findById(draft, 2)
					obj1.a = 2
					obj2.a = 2
				})
				expect(result).not.toBe(base)
				expect(base).toEqual(
					new Set([
						{id: 1, a: 1},
						{id: 2, a: 1}
					])
				)
				expect(result).toEqual(
					new Set([
						{id: 1, a: 2},
						{id: 2, a: 2}
					])
				)
			})

			it("supports 'keys'", () => {
				const base = new Set([
					{id: 1, a: 1},
					{id: 2, a: 1}
				])
				const findById = (set, id) => {
					for (const item of set.keys()) {
						if (item.id === id) return item
					}
					return null
				}
				const result = produce(base, draft => {
					const obj1 = findById(draft, 1)
					const obj2 = findById(draft, 2)
					obj1.a = 2
					obj2.a = 2
				})
				expect(result).not.toBe(base)
				expect(base).toEqual(
					new Set([
						{id: 1, a: 1},
						{id: 2, a: 1}
					])
				)
				expect(result).toEqual(
					new Set([
						{id: 1, a: 2},
						{id: 2, a: 2}
					])
				)
			})

			it("supports forEach with mutation after reads", () => {
				const base = new Set([
					{id: 1, a: 1},
					{id: 2, a: 2}
				])
				const result = produce(base, draft => {
					let sum1 = 0
					draft.forEach(({a}) => {
						sum1 += a
					})
					expect(sum1).toBe(3)
					let sum2 = 0
					draft.forEach(item => {
						item.a += 10
						sum2 += item.a
					})
					expect(sum2).toBe(23)
				})
				expect(result).not.toBe(base)
				expect(base).toEqual(
					new Set([
						{id: 1, a: 1},
						{id: 2, a: 2}
					])
				)
				expect(result).toEqual(
					new Set([
						{id: 1, a: 11},
						{id: 2, a: 12}
					])
				)
			})

			it("state stays the same if the same item is added", () => {
				const nextState = produce(baseState, s => {
					s.aSet.add("Luke")
				})
				expect(nextState).toBe(baseState)
				expect(nextState.aSet).toBe(baseState.aSet)
			})

			it("can add new items", () => {
				const nextState = produce(baseState, s => {
					// Set.prototype.set should return the Set itself
					const res = s.aSet.add("force")
					if (!global.USES_BUILD) expect(res).toBe(s.aSet[DRAFT_STATE].draft_)
				})
				expect(nextState).not.toBe(baseState)
				expect(nextState.aSet).not.toBe(baseState.aSet)
				expect(baseState.aSet.has("force")).toBe(false)
				expect(nextState.aSet.has("force")).toBe(true)
			})

			it("returns 'size'", () => {
				const nextState = produce(baseState, s => {
					s.aSet.add("newKey")
					expect(s.aSet.size).toBe(baseState.aSet.size + 1)
				})
				expect(nextState).not.toBe(baseState)
				expect(nextState.aSet).not.toBe(baseState.aSet)
				expect(nextState.aSet.has("newKey")).toBe(true)
				expect(nextState.aSet.size).toEqual(baseState.aSet.size + 1)
			})

			it("can use 'delete' to remove items", () => {
				const nextState = produce(baseState, s => {
					expect(s.aSet.has("Luke")).toBe(true)
					expect(s.aSet.delete("Luke")).toBe(true)
					expect(s.aSet.delete("Luke")).toBe(false)
					expect(s.aSet.has("Luke")).toBe(false)
				})
				expect(nextState.aSet).not.toBe(baseState.aSet)
				expect(baseState.aSet.has("Luke")).toBe(true)
				expect(nextState.aSet.has("Luke")).toBe(false)
				expect(nextState.aSet.size).toBe(baseState.aSet.size - 1)
			})

			it("can use 'clear' to remove items", () => {
				const nextState = produce(baseState, s => {
					expect(s.aSet.size).not.toBe(0)
					s.aSet.clear()
					expect(s.aSet.size).toBe(0)
				})
				expect(nextState.aSet).not.toBe(baseState.aSet)
				expect(baseState.aSet.size).not.toBe(0)
				expect(nextState.aSet.size).toBe(0)
			})

			it("supports 'has'", () => {
				const nextState = produce(baseState, s => {
					expect(s.aSet.has("newKey")).toBe(false)
					s.aSet.add("newKey")
					expect(s.aSet.has("newKey")).toBe(true)
				})
				expect(nextState).not.toBe(baseState)
				expect(nextState.aSet).not.toBe(baseState.aSet)
				expect(baseState.aSet.has("newKey")).toBe(false)
				expect(nextState.aSet.has("newKey")).toBe(true)
			})

			it("supports nested sets", () => {
				const base = new Set([new Set(["Serenity"])])
				const result = produce(base, draft => {
					draft.forEach(nestedItem => nestedItem.add("Firefly"))
				})
				expect(result).not.toBe(base)
				expect(base).toEqual(new Set([new Set(["Serenity"])]))
				expect(result).toEqual(new Set([new Set(["Serenity", "Firefly"])]))
			})

			it("supports has / delete on elements from the original", () => {
				const obj = {}
				const set = new Set([obj])
				const next = produce(set, d => {
					expect(d.has(obj)).toBe(true)
					d.add(3)
					expect(d.has(obj)).toBe(true)
					d.delete(obj)
					expect(d.has(obj)).toBe(false)
				})
				expect(next).toEqual(new Set([3]))
			})

			it("revokes sets", () => {
				let m
				produce(baseState, s => {
					m = s.aSet
				})
				expect(() => m.has("x")).toThrowErrorMatchingSnapshot()
				expect(() => m.add("x")).toThrowErrorMatchingSnapshot()
			})

			it("does support instanceof Set", () => {
				const set = new Set()
				produce(set, d => {
					expect(d instanceof Set).toBeTruthy()
				})
			})
		})

		it("supports `immerable` symbol on constructor", () => {
			class One {}
			One[immerable] = true
			const baseState = new One()
			const nextState = produce(baseState, draft => {
				expect(draft).not.toBe(baseState)
				draft.foo = true
			})
			expect(nextState).not.toBe(baseState)
			expect(nextState.foo).toBeTruthy()
		})

		it("preserves symbol properties", () => {
			const test = Symbol("test")
			const baseState = {[test]: true}
			const nextState = produce(baseState, s => {
				expect(s[test]).toBeTruthy()
				s.foo = true
			})
			expect(nextState).toEqual({
				[test]: true,
				foo: true
			})
		})

		if (!global.USES_BUILD)
			it("preserves non-enumerable properties", () => {
				const baseState = {}
				// Non-enumerable object property
				Object.defineProperty(baseState, "foo", {
					value: {a: 1},
					enumerable: false
				})
				// Non-enumerable primitive property
				Object.defineProperty(baseState, "bar", {
					value: 1,
					enumerable: false
				})
				const nextState = produce(baseState, s => {
					expect(s.foo).toBeTruthy()
					expect(isEnumerable(s, "foo")).toBeFalsy()
					s.bar++
					expect(isEnumerable(s, "foo")).toBeFalsy()
					s.foo.a++
					expect(isEnumerable(s, "foo")).toBeFalsy()
				})
				expect(nextState.foo).toBeTruthy()
				expect(isEnumerable(nextState, "foo")).toBeFalsy()
			})

		it("throws on computed properties", () => {
			const baseState = {}
			Object.defineProperty(baseState, "foo", {
				get: () => {},
				enumerable: true
			})
			expect(() => {
				produce(baseState, s => {
					// Proxies only throw once a change is made.
					if (useProxies) {
						s.modified = true
					}
				})
			}).toThrowErrorMatchingSnapshot()
		})

		it("allows inherited computed properties", () => {
			const proto = {}
			Object.defineProperty(proto, "foo", {
				get() {
					return this.bar
				},
				set(val) {
					this.bar = val
				}
			})
			const baseState = Object.create(proto)
			produce(baseState, s => {
				expect(s.bar).toBeUndefined()
				s.foo = {}
				expect(s.bar).toBeDefined()
				expect(s.foo).toBe(s.bar)
			})
		})

		it("optimization: does not visit properties of new data structures if autofreeze is disabled and no drafts are unfinalized", () => {
			const newData = {}
			Object.defineProperty(newData, "x", {
				enumerable: true,
				get() {
					throw new Error("visited!")
				}
			})

			const run = () =>
				produce({}, d => {
					d.data = newData
				})
			if (autoFreeze) {
				expect(run).toThrow("visited!")
			} else {
				expect(run).not.toThrow("visited!")
			}
		})

		it("same optimization doesn't cause draft from nested producers to be unfinished", () => {
			const base = {
				y: 1,
				child: {
					x: 1
				}
			}
			const wrap = produce(draft => {
				return {
					wrapped: draft
				}
			})

			const res = produce(base, draft => {
				draft.y++
				draft.child = wrap(draft.child)
				draft.child.wrapped.x++
			})

			expect(res).toEqual({
				y: 2,
				child: {wrapped: {x: 2}}
			})
		})

		it("supports a base state with multiple references to an object", () => {
			const obj = {}
			const res = produce({a: obj, b: obj}, d => {
				// Two drafts are created for each occurrence of an object in the base state.
				expect(d.a).not.toBe(d.b)
				d.a.z = true
				expect(d.b.z).toBeUndefined()
			})
			expect(res.b).toBe(obj)
			expect(res.a).not.toBe(res.b)
			expect(res.a.z).toBeTruthy()
		})

		// NOTE: Except the root draft.
		it("supports multiple references to any modified draft", () => {
			const next = produce({a: {b: 1}}, d => {
				d.a.b++
				d.b = d.a
			})
			expect(next.a).toBe(next.b)
		})

		it("can rename nested objects (no changes)", () => {
			const nextState = produce({obj: {}}, s => {
				s.foo = s.obj
				delete s.obj
			})
			expect(nextState).toEqual({foo: {}})
		})

		// Very similar to the test before, but the reused object has one
		// property changed, one added, and one removed.
		it("can rename nested objects (with changes)", () => {
			const nextState = produce({obj: {a: 1, b: 1}}, s => {
				s.obj.a = true // change
				delete s.obj.b // delete
				s.obj.c = true // add

				s.foo = s.obj
				delete s.obj
			})
			expect(nextState).toEqual({foo: {a: true, c: true}})
		})

		it("can nest a draft in a new object (no changes)", () => {
			const baseState = {obj: {}}
			const nextState = produce(baseState, s => {
				s.foo = {bar: s.obj}
				delete s.obj
			})
			expect(nextState.foo.bar).toBe(baseState.obj)
		})

		it("can nest a modified draft in a new object", () => {
			const nextState = produce({obj: {a: 1, b: 1}}, s => {
				s.obj.a = true // change
				delete s.obj.b // delete
				s.obj.c = true // add

				s.foo = {bar: s.obj}
				delete s.obj
			})
			expect(nextState).toEqual({foo: {bar: {a: true, c: true}}})
		})

		it("supports assigning undefined to an existing property", () => {
			const nextState = produce(baseState, s => {
				s.aProp = undefined
			})
			expect(nextState).not.toBe(baseState)
			expect(nextState.aProp).toBe(undefined)
		})

		it("supports assigning undefined to a new property", () => {
			const baseState = {}
			const nextState = produce(baseState, s => {
				s.aProp = undefined
			})
			expect(nextState).not.toBe(baseState)
			expect(nextState.aProp).toBe(undefined)
		})

		// NOTE: ES5 drafts only protect existing properties when revoked.
		it("revokes the draft once produce returns", () => {
			const expectRevoked = (fn, shouldThrow = true) => {
				if (shouldThrow) expect(fn).toThrowErrorMatchingSnapshot()
				else expect(fn).not.toThrow()
			}

			// Test object drafts:
			let draft
			produce({a: 1, b: 1}, s => {
				draft = s
				delete s.b
			})

			// Access known property on object draft.
			expectRevoked(() => {
				draft.a
			})

			// Assign known property on object draft.
			expectRevoked(() => {
				draft.a = true
			})

			// Access unknown property on object draft.
			expectRevoked(() => {
				draft.z
			}, useProxies)

			// Assign unknown property on object draft.
			expectRevoked(() => {
				draft.z = true
			}, useProxies)

			// Test array drafts:
			produce([1, 2], s => {
				draft = s
				s.pop()
			})

			// Access known index of an array draft.
			expectRevoked(() => {
				draft[0]
			})

			// Assign known index of an array draft.
			expectRevoked(() => {
				draft[0] = true
			})

			// Access unknown index of an array draft.
			expectRevoked(() => {
				draft[1]
			}, useProxies)

			// Assign unknown index of an array draft.
			expectRevoked(() => {
				draft[1] = true
			}, useProxies)
		})

		it("can access a child draft that was created before the draft was modified", () => {
			produce({a: {}}, s => {
				const before = s.a
				s.b = 1
				expect(s.a).toBe(before)
			})
		})

		it("should reflect all changes made in the draft immediately", () => {
			produce(baseState, draft => {
				draft.anArray[0] = 5
				draft.anArray.unshift("test")
				if (!global.USES_BUILD)
					expect(enumerableOnly(draft.anArray)).toEqual([
						"test",
						5,
						2,
						{c: 3},
						1
					])
				draft.stuffz = "coffee"
				expect(draft.stuffz).toBe("coffee")
			})
		})

		if (useProxies)
			it("throws when Object.defineProperty() is used on drafts", () => {
				expect(() => {
					produce({}, draft => {
						Object.defineProperty(draft, "xx", {
							enumerable: true,
							writeable: true,
							value: 2
						})
					})
				}).toThrowErrorMatchingSnapshot()
			})

		it("should handle constructor correctly", () => {
			const baseState = {
				arr: new Array(),
				obj: new Object()
			}
			const result = produce(baseState, draft => {
				draft.arrConstructed = draft.arr.constructor(1)
				draft.objConstructed = draft.obj.constructor(1)
			})
			expect(result.arrConstructed).toEqual(new Array().constructor(1))
			expect(result.objConstructed).toEqual(new Object().constructor(1))
		})

		it("should handle equality correctly - 1", () => {
			const baseState = {
				y: 3 / 0,
				z: NaN
			}
			const nextState = produce(baseState, draft => {
				draft.y = 4 / 0
				draft.z = NaN
			})
			expect(nextState).toBe(baseState)
		})

		it("should handle equality correctly - 2", () => {
			const baseState = {
				x: -0
			}
			const nextState = produce(baseState, draft => {
				draft.x = +0
			})
			expect(nextState).not.toBe(baseState)
			expect(nextState).not.toEqual(baseState)
		})

		// AKA: recursive produce calls
		describe("nested producers", () => {
			describe("when base state is not a draft", () => {
				// This test ensures the global state used to manage proxies is
				// never left in a corrupted state by a nested `produce` call.
				it("never affects its parent producer implicitly", () => {
					const base = {obj: {a: 1}}
					const next = produce(base, draft => {
						// Notice how `base.obj` is passed, not `draft.obj`
						const obj2 = produce(base.obj, draft2 => {
							draft2.a = 0
						})
						expect(obj2.a).toBe(0)
						expect(draft.obj.a).toBe(1) // effects should not be visible outside
					})
					expect(next).toBe(base)
				})
			})

			describe("when base state is a draft", () => {
				it("always wraps the draft in a new draft", () => {
					produce({}, parent => {
						produce(parent, child => {
							expect(child).not.toBe(parent)
							expect(isDraft(child)).toBeTruthy()
							expect(original(child)).toBe(parent)
						})
					})
				})

				// Reported by: https://github.com/mweststrate/immer/issues/343
				it("ensures each property is drafted", () => {
					produce({a: {}, b: {}}, parent => {
						parent.a // Access "a" but not "b"
						produce(parent, child => {
							child.c = 1
							expect(isDraft(child.a)).toBeTruthy()
							expect(isDraft(child.b)).toBeTruthy()
						})
					})
				})

				it("preserves any pending changes", () => {
					produce({a: 1, b: 1, d: 1}, parent => {
						parent.b = 2
						parent.c = 2
						delete parent.d
						produce(parent, child => {
							expect(child.a).toBe(1) // unchanged
							expect(child.b).toBe(2) // changed
							expect(child.c).toBe(2) // added
							expect(child.d).toBeUndefined() // deleted
						})
					})
				})
			})

			describe("when base state contains a draft", () => {
				it("wraps unowned draft with its own draft", () => {
					produce({a: {}}, parent => {
						produce({a: parent.a}, child => {
							expect(child.a).not.toBe(parent.a)
							expect(isDraft(child.a)).toBeTruthy()
							expect(original(child.a)).toBe(parent.a)
						})
					})
				})

				it("returns unowned draft if no changes were made", () => {
					produce({a: {}}, parent => {
						const result = produce({a: parent.a}, () => {})
						expect(result.a).toBe(parent.a)
					})
				})

				it("clones the unowned draft when changes are made", () => {
					produce({a: {}}, parent => {
						const result = produce({a: parent.a}, child => {
							child.a.b = 1
						})
						expect(result.a).not.toBe(parent.a)
						expect(result.a.b).toBe(1)
						expect("b" in parent.a).toBeFalsy()
					})
				})

				// We cannot auto-freeze the result of a nested producer,
				// because it may contain a draft from a parent producer.
				it("never auto-freezes the result", () => {
					produce({a: {}}, parent => {
						const r = produce({a: parent.a}, child => {
							child.b = 1 // Ensure a copy is returned.
						})
						expect(Object.isFrozen(r)).toBeFalsy()
					})
				})
			})

			// "Upvalues" are variables from a parent scope.
			it("does not finalize upvalue drafts", () => {
				produce({a: {}, b: {}}, parent => {
					expect(produce({}, () => parent)).toBe(parent)
					parent.x // Ensure proxy not revoked.

					expect(produce({}, () => [parent])[0]).toBe(parent)
					parent.x // Ensure proxy not revoked.

					expect(produce({}, () => parent.a)).toBe(parent.a)
					parent.a.x // Ensure proxy not revoked.

					// Modified parent test
					parent.c = 1
					expect(produce({}, () => [parent.b])[0]).toBe(parent.b)
					parent.b.x // Ensure proxy not revoked.
				})
			})

			it("works with interweaved Immer instances", () => {
				const options = {useProxies, autoFreeze}
				const one = createPatchedImmer(options)
				const two = createPatchedImmer(options)

				const base = {}
				const result = one.produce(base, s1 =>
					two.produce({s1}, s2 => {
						expect(original(s2.s1)).toBe(s1)
						s2.n = 1
						s2.s1 = one.produce({s2}, s3 => {
							expect(original(s3.s2)).toBe(s2)
							expect(original(s3.s2.s1)).toBe(s2.s1)
							return s3.s2.s1
						})
					})
				)
				expect(result.n).toBe(1)
				expect(result.s1).toBe(base)
			})
		})

		if (useProxies)
			it("throws when Object.setPrototypeOf() is used on a draft", () => {
				produce({}, draft => {
					expect(() =>
						Object.setPrototypeOf(draft, Array)
					).toThrowErrorMatchingSnapshot()
				})
			})

		it("supports the 'in' operator", () => {
			produce(baseState, draft => {
				// Known property
				expect("anArray" in draft).toBe(true)
				expect(Reflect.has(draft, "anArray")).toBe(true)

				// Unknown property
				expect("bla" in draft).toBe(false)
				expect(Reflect.has(draft, "bla")).toBe(false)

				// Known index
				expect(0 in draft.anArray).toBe(true)
				expect("0" in draft.anArray).toBe(true)
				expect(Reflect.has(draft.anArray, 0)).toBe(true)
				expect(Reflect.has(draft.anArray, "0")).toBe(true)

				// Unknown index
				expect(17 in draft.anArray).toBe(false)
				expect("17" in draft.anArray).toBe(false)
				expect(Reflect.has(draft.anArray, 17)).toBe(false)
				expect(Reflect.has(draft.anArray, "17")).toBe(false)
			})
		})

		it("'this' should not be bound anymore - 1", () => {
			const base = {x: 3}
			const next1 = produce(base, function() {
				expect(this).toBe(undefined)
			})
		})

		it("'this' should not be bound anymore - 2", () => {
			const incrementor = produce(function() {
				expect(this).toBe(undefined)
			})
			incrementor()
		})

		it("should be possible to use dynamic bound this", () => {
			const world = {
				counter: {count: 1},
				inc: produce(function(draft) {
					expect(this).toBe(world)
					draft.counter.count = this.counter.count + 1
				})
			}

			expect(world.inc(world).counter.count).toBe(2)
		})

		it("doesnt recurse into frozen structures if external data is frozen", () => {
			const frozen = {}
			Object.defineProperty(frozen, "x", {
				get() {
					throw "oops"
				},
				enumerable: true,
				configurable: true
			})
			Object.freeze(frozen)

			expect(() => {
				produce({}, d => {
					d.x = frozen
				})
			}).not.toThrow()
		})

		// See here: https://github.com/mweststrate/immer/issues/89
		it("supports the spread operator", () => {
			const base = {foo: {x: 0, y: 0}, bar: [0, 0]}
			const result = produce(base, draft => {
				draft.foo = {x: 1, ...draft.foo, y: 1}
				draft.bar = [1, ...draft.bar, 1]
			})
			expect(result).toEqual({
				foo: {x: 0, y: 1},
				bar: [1, 0, 0, 1]
			})
		})

		it("processes with lodash.set", () => {
			const base = [{id: 1, a: 1}]
			const result = produce(base, draft => {
				lodash.set(draft, "[0].a", 2)
			})
			expect(base[0].a).toEqual(1)
			expect(result[0].a).toEqual(2)
		})

		it("processes with lodash.find", () => {
			const base = [{id: 1, a: 1}]
			const result = produce(base, draft => {
				const obj1 = lodash.find(draft, {id: 1})
				lodash.set(obj1, "a", 2)
			})
			expect(base[0].a).toEqual(1)
			expect(result[0].a).toEqual(2)
		})

		it("does not draft external data", () => {
			const externalData = {x: 3}
			const base = {}
			const next = produce(base, draft => {
				// potentially, we *could* draft external data automatically, but only if those statements are not switched...
				draft.y = externalData
				draft.y.x += 1
				externalData.x += 1
			})
			expect(next).toEqual({y: {x: 5}})
			expect(externalData.x).toBe(5)
			expect(next.y).toBe(externalData)
		})

		it("does not create new state unnecessary, #491", () => {
			const a = {highlight: true}
			const next1 = produce(a, draft => {
				draft.highlight = false
				draft.highlight = true
			})
			// See explanation in issue
			expect(next1).not.toBe(a)

			const next2 = produce(a, draft => {
				draft.highlight = true
			})
			expect(next2).toBe(a)
		})

		autoFreeze &&
			test.skip("issue #462 - frozen", () => {
				var origin = {
					a: {
						value: "no"
					},
					b: {
						value: "no"
					}
				}
				var im = produce(origin, origin => {
					origin.a.value = "im"
				})
				expect(() => (origin.b.value = "yes")).toThrow() // should throw!
				// to prevent this...:
				// expect(im.b.value).toBe('no');
			})

		autoFreeze &&
			test("issue #469, state not frozen", () => {
				const project = produce(
					{
						id: 1,
						tracks: [{id: 1}]
					},
					() => {}
				)

				expect(() => {
					project.id = 2 // Does not throw error
				}).toThrowError("Cannot assign to read only property 'id'")

				expect(() => {
					Object.assign(project, {id: 2}) // Uncaught TypeError: Cannot assign to read only property 'id' of object '#<Object>'
				}).toThrowError("Cannot assign to read only property 'id'")
			})

		describe("recipe functions", () => {
			it("can return a new object", () => {
				const base = {x: 3}
				const res = produce(base, d => {
					return {x: d.x + 1}
				})
				expect(res).not.toBe(base)
				expect(res).toEqual({x: 4})
			})

			it("can return the draft", () => {
				const base = {x: 3}
				const res = produce(base, d => {
					d.x = 4
					return d
				})
				expect(res).not.toBe(base)
				expect(res).toEqual({x: 4})
			})

			it("can return an unmodified child draft", () => {
				const base = {a: {}}
				const res = produce(base, d => {
					return d.a
				})
				expect(res).toBe(base.a)
			})

			// TODO: Avoid throwing if only the child draft was modified.
			it("cannot return a modified child draft", () => {
				const base = {a: {}}
				expect(() => {
					produce(base, d => {
						d.a.b = 1
						return d.a
					})
				}).toThrowErrorMatchingSnapshot()
			})

			it("can return a frozen object", () => {
				const res = deepFreeze([{x: 3}])
				expect(produce({}, () => res)).toBe(res)
			})

			it("can return an object with two references to another object", () => {
				const next = produce({}, d => {
					const obj = {}
					return {obj, arr: [obj]}
				})
				expect(next.obj).toBe(next.arr[0])
			})

			it("can return an object with two references to an unmodified draft", () => {
				const base = {a: {}}
				const next = produce(base, d => {
					return [d.a, d.a]
				})
				expect(next[0]).toBe(base.a)
				expect(next[0]).toBe(next[1])
			})

			it("cannot return an object that references itself", () => {
				const res = {}
				res.self = res
				expect(() => {
					produce(res, () => res.self)
				}).toThrowErrorMatchingSnapshot()
			})
		})

		describe("async recipe function", () => {
			it("can modify the draft", () => {
				const base = {a: 0, b: 0}
				return produce(base, async d => {
					d.a = 1
					await Promise.resolve()
					d.b = 1
				}).then(res => {
					expect(res).not.toBe(base)
					expect(res).toEqual({a: 1, b: 1})
				})
			})

			it("works with rejected promises", () => {
				let draft
				const base = {a: 0, b: 0}
				const err = new Error("passed")
				return produce(base, d => {
					draft = d
					draft.b = 1
					return Promise.reject(err)
				}).then(
					() => {
						throw "failed"
					},
					e => {
						expect(e).toBe(err)
						expect(() => draft.a).toThrowErrorMatchingSnapshot()
					}
				)
			})

			it("supports recursive produce calls after await", () => {
				const base = {obj: {k: 1}}
				return produce(base, d => {
					const obj = d.obj
					delete d.obj
					return Promise.resolve().then(() => {
						d.a = produce({}, d => {
							d.b = obj // Assign a draft owned by the parent scope.
						})

						// Auto-freezing is prevented when an unowned draft exists.
						expect(Object.isFrozen(d.a)).toBeFalsy()

						// Ensure `obj` is not revoked.
						obj.c = 1
					})
				}).then(res => {
					expect(res).not.toBe(base)
					expect(res).toEqual({
						a: {b: {k: 1, c: 1}}
					})
				})
			})
		})

		it("throws when the draft is modified and another object is returned", () => {
			const base = {x: 3}
			expect(() => {
				produce(base, draft => {
					draft.x = 4
					return {x: 5}
				})
			}).toThrowErrorMatchingSnapshot()
		})

		it("should fix #117 - 1", () => {
			const reducer = (state, action) =>
				produce(state, draft => {
					switch (action.type) {
						case "SET_STARTING_DOTS":
							return draft.availableStartingDots.map(a => a)
						default:
							break
					}
				})
			const base = {
				availableStartingDots: [
					{dots: 4, count: 1},
					{dots: 3, count: 2},
					{dots: 2, count: 3},
					{dots: 1, count: 4}
				]
			}
			const next = reducer(base, {type: "SET_STARTING_DOTS"})
			expect(next).toEqual(base.availableStartingDots)
			expect(next).not.toBe(base.availableStartingDots)
		})

		it("should fix #117 - 2", () => {
			const reducer = (state, action) =>
				produce(state, draft => {
					switch (action.type) {
						case "SET_STARTING_DOTS":
							return {
								dots: draft.availableStartingDots.map(a => a)
							}
						default:
							break
					}
				})
			const base = {
				availableStartingDots: [
					{dots: 4, count: 1},
					{dots: 3, count: 2},
					{dots: 2, count: 3},
					{dots: 1, count: 4}
				]
			}
			const next = reducer(base, {type: "SET_STARTING_DOTS"})
			expect(next).toEqual({dots: base.availableStartingDots})
		})

		it("cannot always detect noop assignments - 0", () => {
			const baseState = {x: {y: 3}}
			const nextState = produce(baseState, d => {
				const a = d.x
				d.x = a
			})
			expect(nextState).toBe(baseState)
		})

		it("cannot always detect noop assignments - 1", () => {
			const baseState = {x: {y: 3}}
			const nextState = produce(baseState, d => {
				const a = d.x
				d.x = 4
				d.x = a
			})
			// Ideally, this should actually be the same instances
			// but this would be pretty expensive to detect,
			// so we don't atm
			expect(nextState).not.toBe(baseState)
		})

		it("cannot always detect noop assignments - 2", () => {
			const baseState = {x: {y: 3}}
			const nextState = produce(baseState, d => {
				const a = d.x
				const stuff = a.y + 3
				d.x = 4
				d.x = a
			})
			// Ideally, this should actually be the same instances
			// but this would be pretty expensive to detect,
			// so we don't atm
			expect(nextState).not.toBe(baseState)
		})

		it("cannot always detect noop assignments - 3", () => {
			const baseState = {x: 3}
			const nextState = produce(baseState, d => {
				d.x = 3
			})
			expect(nextState).toBe(baseState)
		})

		it("cannot always detect noop assignments - 4", () => {
			const baseState = {x: 3}
			const nextState = produce(baseState, d => {
				d.x = 4
				d.x = 3
			})
			// Ideally, this should actually be the same instances
			// but this would be pretty expensive to detect,
			// so we don't atm
			expect(nextState).not.toBe(baseState)
		})

		it("cannot produce undefined by returning undefined", () => {
			const base = 3
			expect(produce(base, () => 4)).toBe(4)
			expect(produce(base, () => null)).toBe(null)
			expect(produce(base, () => undefined)).toBe(3)
			expect(produce(base, () => {})).toBe(3)
			expect(produce(base, () => nothing)).toBe(undefined)

			expect(produce({}, () => undefined)).toEqual({})
			expect(produce({}, () => nothing)).toBe(undefined)
			expect(produce(3, () => nothing)).toBe(undefined)

			expect(produce(() => undefined)({})).toEqual({})
			expect(produce(() => nothing)({})).toBe(undefined)
			expect(produce(() => nothing)(3)).toBe(undefined)
		})

		describe("base state type", () => {
			if (!global.USES_BUILD) testObjectTypes(produce)
			testLiteralTypes(produce)
		})

		afterEach(() => {
			expect(baseState).toBe(origBaseState)
			expect(baseState).toEqual(createBaseState())
		})

		class Foo {}
		function createBaseState() {
			const data = {
				anInstance: new Foo(),
				anArray: [3, 2, {c: 3}, 1],
				aMap: new Map([
					["jedi", {name: "Luke", skill: 10}],
					["jediTotal", 42],
					["force", "these aren't the droids you're looking for"]
				]),
				aSet: new Set([
					"Luke",
					42,
					{
						jedi: "Yoda"
					}
				]),
				aProp: "hi",
				anObject: {
					nested: {
						yummie: true
					},
					coffee: false
				}
			}
			return autoFreeze ? deepFreeze(data) : data
		}
	})

	it(`works with spread #524 - ${name}`, () => {
		const state = {
			level1: {
				level2: {
					level3: "data"
				}
			}
		}

		const nextState = produce(state, draft => {
			return {...draft}
		})
		const nextState1 = produce(state, draft => {
			const newLevel1 = produce(draft.level1, level1Draft => {
				return {...level1Draft}
			})
			draft.level1 = newLevel1
		})

		const nextState2 = produce(state, draft => {
			const newLevel1 = produce(draft.level1, level1Draft => {
				return {...level1Draft}
			})
			return {
				level1: newLevel1
			}
		})

		const nextState3 = produce(state, draft => {
			const newLevel1 = produce(draft.level1, level1Draft => {
				return Object.assign({}, level1Draft)
			})
			return Object.assign(draft, {
				level1: newLevel1
			})
		})

		const expected = {level1: {level2: {level3: "data"}}}
		expect(nextState1).toEqual(expected)
		expect(nextState2).toEqual(expected)
		expect(nextState3).toEqual(expected)
	})

	it(`Something with nested producers #522 ${name}`, () => {
		function initialStateFactory() {
			return {
				substate: {
					array: [
						{id: "id1", value: 0},
						{id: "id2", value: 0}
					]
				},
				array: [
					{id: "id1", value: 0},
					{id: "id2", value: 0}
				]
			}
		}

		const globalProducer = produce(draft => {
			draft.substate = subProducer(draft.substate)
			draft.array = arrayProducer(draft.array)
		}, initialStateFactory())

		const subProducer = produce(draftSubState => {
			draftSubState.array = arrayProducer(draftSubState.array)
		})

		const arrayProducer = produce(draftArray => {
			draftArray[0].value += 5
		})

		{
			const state = globalProducer(undefined)
			expect(state.array[0].value).toBe(5)
			expect(state.array.length).toBe(2)
			expect(state.array[1]).toMatchObject({
				id: "id2",
				value: 0
			})
		}

		{
			const state = globalProducer(undefined)
			expect(state.substate.array[0].value).toBe(5)
			expect(state.substate.array.length).toBe(2)
			expect(state.substate.array[1]).toMatchObject({
				id: "id2",
				value: 0
			})
			expect(state.substate.array).toMatchObject(state.array)
		}
	})

	describe(`isDraft - ${name}`, () => {
		it("returns true for object drafts", () => {
			produce({}, state => {
				expect(isDraft(state)).toBeTruthy()
			})
		})
		it("returns true for array drafts", () => {
			produce([], state => {
				expect(isDraft(state)).toBeTruthy()
			})
		})
		it("returns true for objects nested in object drafts", () => {
			produce({a: {b: {}}}, state => {
				expect(isDraft(state.a)).toBeTruthy()
				expect(isDraft(state.a.b)).toBeTruthy()
			})
		})
		it("returns false for new objects added to a draft", () => {
			produce({}, state => {
				state.a = {}
				expect(isDraft(state.a)).toBeFalsy()
			})
		})
		it("returns false for objects returned by the producer", () => {
			const object = produce(null, Object.create)
			expect(isDraft(object)).toBeFalsy()
		})
		it("returns false for arrays returned by the producer", () => {
			const array = produce(null, _ => [])
			expect(isDraft(array)).toBeFalsy()
		})
		it("returns false for object drafts returned by the producer", () => {
			const object = produce({}, state => state)
			expect(isDraft(object)).toBeFalsy()
		})
		it("returns false for array drafts returned by the producer", () => {
			const array = produce([], state => state)
			expect(isDraft(array)).toBeFalsy()
		})
	})

	describe(`complex nesting map / set / object`, () => {
		const a = {a: 1}
		const b = {b: 2}
		const c = {c: 3}
		const set1 = new Set([a, b])
		const set2 = new Set([c])
		const map = new Map([
			["set1", set1],
			["set2", set2]
		])
		const base = {map}

		function first(set) {
			return Array.from(set.values())[0]
		}

		function second(set) {
			return Array.from(set.values())[1]
		}

		test(`modify deep object`, () => {
			const [res, patches] = produceWithPatches(base, draft => {
				const v = first(draft.map.get("set1"))
				expect(original(v)).toBe(a)
				expect(v).toEqual(a)
				expect(v).not.toBe(a)
				v.a++
			})
			expect(res).toMatchSnapshot()
			expect(patches).toMatchSnapshot()
			expect(a.a).toBe(1)
			expect(base.map.get("set1")).toBe(set1)
			expect(first(base.map.get("set1"))).toBe(a)
			expect(res).not.toBe(base)
			expect(res.map).not.toBe(base.map)
			expect(res.map.get("set1")).not.toBe(base.map.get("set1"))
			expect(second(base.map.get("set1"))).toBe(b)
			expect(base.map.get("set2")).toBe(set2)
			expect(first(res.map.get("set1"))).toEqual({a: 2})
		})

		test(`modify deep object - keep value`, () => {
			const [res, patches] = produceWithPatches(base, draft => {
				const v = first(draft.map.get("set1"))
				expect(original(v)).toBe(a)
				expect(v).toEqual(a)
				expect(v).not.toBe(a)
				v.a = 1 // same value
			})
			expect(a.a).toBe(1)
			expect(base.map.get("set1")).toBe(set1)
			expect(first(base.map.get("set1"))).toBe(a)
			expect(res).toBe(base)
			expect(res.map).toBe(base.map)
			expect(res.map.get("set1")).toBe(base.map.get("set1"))
			expect(first(res.map.get("set1"))).toBe(a)
			expect(second(base.map.get("set1"))).toBe(b)
			expect(base.map.get("set2")).toBe(set2)
			expect(patches.length).toBe(0)
		})
	})
}

function testObjectTypes(produce) {
	class Foo {
		constructor(foo) {
			this.foo = foo
			this[immerable] = true
		}
	}
	const values = {
		"empty object": {},
		"plain object": {a: 1, b: 2},
		"object (no prototype)": Object.create(null),
		"empty array": [],
		"plain array": [1, 2],
		"class instance (draftable)": new Foo(1)
	}
	for (const name in values) {
		const value = values[name]
		const copy = shallowCopy(value)
		testObjectType(name, value)
		testObjectType(name + " (frozen)", Object.freeze(copy))
	}
	function testObjectType(name, base) {
		describe(name, () => {
			it("creates a draft", () => {
				produce(base, draft => {
					expect(draft).not.toBe(base)
					expect(shallowCopy(draft, true)).toEqual(base)
				})
			})

			it("preserves the prototype", () => {
				const proto = Object.getPrototypeOf(base)
				produce(base, draft => {
					expect(Object.getPrototypeOf(draft)).toBe(proto)
				})
			})

			it("returns the base state when no changes are made", () => {
				expect(produce(base, () => {})).toBe(base)
			})

			it("returns a copy when changes are made", () => {
				const random = Math.random()
				const result = produce(base, draft => {
					draft[0] = random
				})
				expect(result).not.toBe(base)
				expect(result.constructor).toBe(base.constructor)
				expect(result[0]).toBe(random)
			})
		})
	}
}

function testLiteralTypes(produce) {
	class Foo {}
	const values = {
		"falsy number": 0,
		"truthy number": 1,
		"negative number": -1,
		NaN: NaN,
		infinity: 1 / 0,
		true: true,
		false: false,
		"empty string": "",
		"truthy string": "1",
		null: null,
		undefined: undefined,

		/**
		 * These objects are treated as literals because Immer
		 * does not know how to draft them.
		 */
		function: () => {},
		"regexp object": /.+/g,
		"boxed number": new Number(0),
		"boxed string": new String(""),
		"boxed boolean": new Boolean(),
		"date object": new Date(),
		"class instance (not draftable)": new Foo()
	}
	for (const name in values) {
		describe(name, () => {
			const value = values[name]

			it("does not create a draft", () => {
				produce(value, draft => {
					expect(draft).toBe(value)
				})
			})

			it("returns the base state when no changes are made", () => {
				expect(produce(value, () => {})).toBe(value)
			})

			if (value && typeof value == "object") {
				it("does not return a copy when changes are made", () => {
					expect(
						produce(value, draft => {
							draft.foo = true
						})
					).toBe(value)
				})
			}
		})
	}
}

function enumerableOnly(x) {
	const copy = Array.isArray(x) ? x.slice() : Object.assign({}, x)
	each(copy, (prop, value) => {
		if (value && typeof value === "object") {
			copy[prop] = enumerableOnly(value)
		}
	})
	return copy
}

function isEnumerable(base, prop) {
	const desc = Object.getOwnPropertyDescriptor(base, prop)
	return desc && desc.enumerable ? true : false
}
