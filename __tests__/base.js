"use strict"
import {vi} from "vitest"
import {
	Immer,
	nothing,
	original,
	isDraft,
	immerable,
	enablePatches,
	enableMapSet
} from "../src/immer"
import {each, shallowCopy, DRAFT_STATE} from "../src/internal"
import deepFreeze from "deep-freeze"
import * as lodash from "lodash"

enablePatches()
enableMapSet()

vi.setConfig({
	testTimeout: 2000
})

const isProd = process.env.NODE_ENV === "production"

test("immer should have no dependencies", () => {
	expect(require("../package.json").dependencies).toBeUndefined()
})

for (const autoFreeze of [true, false]) {
	for (const useStrictShallowCopy of [true, false]) {
		for (const useListener of [true, false]) {
			const name = `${autoFreeze ? "auto-freeze=true" : "auto-freeze=false"}:${
				useStrictShallowCopy ? "shallow-copy=true" : "shallow-copy=false"
			}:${useListener ? "use-listener=true" : "use-listener=false"}`
			runBaseTest(name, autoFreeze, useStrictShallowCopy, useListener)
		}
	}
}

class Foo {}

function runBaseTest(name, autoFreeze, useStrictShallowCopy, useListener) {
	const listener = useListener ? function() {} : undefined
	const {produce, produceWithPatches} = createPatchedImmer({
		autoFreeze,
		useStrictShallowCopy
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
				delete s.nonexisting
			})
			expect(nextState).not.toBe(baseState)
			expect(nextState.anObject).not.toBe(baseState.anObject)
			expect(nextState.anObject.nested).toBe(undefined)
		})

		it("can delete props - 2", () => {
			const nextState = produce(baseState, s => {
				delete s.nonexisting
			})
			expect(nextState).toBe(baseState)
		})

		// Found by: https://github.com/mweststrate/immer/pull/267
		it("can delete props added in the producer", () => {
			const nextState = produce(baseState, s => {
				s.anObject.test = true
				delete s.anObject.test
			})
			expect(nextState).not.toBe(baseState)
			expect(nextState).toEqual(baseState)
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
			expect(nextState).not.toBe(baseState)
			expect(nextState).toEqual(baseState)
		})

		it("can get property descriptors", () => {
			const getDescriptor = Object.getOwnPropertyDescriptor
			const baseState = deepFreeze([{a: 1}])
			produce(baseState, arr => {
				const obj = arr[0]
				const desc = {
					configurable: true,
					enumerable: true,
					writable: true
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

			describe("mutating array methods", () => {
				// Reported here: https://github.com/mweststrate/immer/issues/116
				it("can pop then push", () => {
					const nextState = produce([1, 2, 3], s => {
						s.pop()
						s.push(100)
					})
					expect(nextState).toEqual([1, 2, 100])
				})

				it("can be sorted", () => {
					const baseState = [{value: 3}, {value: 1}, {value: 2}]
					const nextState = produce(baseState, s => {
						s.sort((a, b) => a.value - b.value)
					})
					expect(nextState).not.toBe(baseState)
					expect(nextState).toEqual([{value: 1}, {value: 2}, {value: 3}])
				})

				it("can be reversed", () => {
					const baseState = [{value: 1}, {value: 2}, {value: 3}]
					const nextState = produce(baseState, s => {
						s.reverse()
					})
					expect(nextState).not.toBe(baseState)
					expect(nextState).toEqual([{value: 3}, {value: 2}, {value: 1}])
				})

				it("can be sorted with existing proxies", () => {
					const baseState = [{value: 3}, {value: 1}, {value: 2}]
					const nextState = produce(baseState, s => {
						// First mutate a nested object to create a proxy
						s[0].value = 4
						// Then sort the array
						s.sort((a, b) => a.value - b.value)
					})
					expect(nextState).not.toBe(baseState)
					expect(nextState).toEqual([{value: 1}, {value: 2}, {value: 4}])
				})

				it("can be reversed with existing proxies", () => {
					const baseState = [{value: 1}, {value: 2}, {value: 3}]
					const nextState = produce(baseState, s => {
						// First mutate a nested object to create a proxy
						s[1].value = 5
						// Then reverse the array
						s.reverse()
					})
					expect(nextState).not.toBe(baseState)
					expect(nextState).toEqual([{value: 3}, {value: 5}, {value: 1}])
				})

				it("can be sorted with unmodified existing proxies", () => {
					const baseState = [{value: 3}, {value: 1}, {value: 2}]
					const nextState = produce(baseState, s => {
						// Access a nested object to create a proxy, but don't modify it
						const firstValue = s[0].value // This creates a proxy for s[0]
						expect(firstValue).toBe(3) // But we don't modify it

						// Then sort the array
						s.sort((a, b) => a.value - b.value)
					})
					expect(nextState).not.toBe(baseState)
					expect(nextState).toEqual([{value: 1}, {value: 2}, {value: 3}])
				})

				describe("push()", () => {
					test("push single item", () => {
						const base = {items: [{id: 1}, {id: 2}]}
						const result = produce(base, draft => {
							draft.items.push({id: 3})
						})
						expect(result.items).toHaveLength(3)
						expect(result.items[2].id).toBe(3)
					})

					test("push multiple items", () => {
						const base = {items: [{id: 1}]}
						const result = produce(base, draft => {
							draft.items.push({id: 2}, {id: 3}, {id: 4})
						})
						expect(result.items).toHaveLength(4)
						expect(result.items[3].id).toBe(4)
					})

					test("push then mutate pushed item", () => {
						const base = {items: [{id: 1}]}
						const result = produce(base, draft => {
							draft.items.push({id: 2, value: 10})
							draft.items[1].value = 20
						})
						expect(result.items[1].value).toBe(20)
					})

					test("push returns new length", () => {
						const base = {items: [1, 2]}
						produce(base, draft => {
							const newLength = draft.items.push(3, 4)
							expect(newLength).toBe(4)
						})
					})
				})

				describe("unshift()", () => {
					test("unshift single item", () => {
						const base = {items: [{id: 2}, {id: 3}]}
						const result = produce(base, draft => {
							draft.items.unshift({id: 1})
						})
						expect(result.items).toHaveLength(3)
						expect(result.items[0].id).toBe(1)
						expect(result.items[1].id).toBe(2)
					})

					test("unshift multiple items", () => {
						const base = {items: [{id: 4}]}
						const result = produce(base, draft => {
							draft.items.unshift({id: 1}, {id: 2}, {id: 3})
						})
						expect(result.items).toHaveLength(4)
						expect(result.items[0].id).toBe(1)
						expect(result.items[3].id).toBe(4)
					})

					test("unshift then mutate unshifted item", () => {
						const base = {items: [{id: 2}]}
						const result = produce(base, draft => {
							draft.items.unshift({id: 1, value: 10})
							draft.items[0].value = 20
						})
						expect(result.items[0].value).toBe(20)
					})

					test("unshift returns new length", () => {
						const base = {items: [3, 4]}
						produce(base, draft => {
							const newLength = draft.items.unshift(1, 2)
							expect(newLength).toBe(4)
						})
					})
				})

				describe("shift()", () => {
					test("shift removes first item", () => {
						const base = {items: [{id: 1}, {id: 2}, {id: 3}]}
						const result = produce(base, draft => {
							const removed = draft.items.shift()
							expect(removed.id).toBe(1)
						})
						expect(result.items).toHaveLength(2)
						expect(result.items[0].id).toBe(2)
					})

					test("shift on empty array returns undefined", () => {
						const base = {items: []}
						produce(base, draft => {
							const removed = draft.items.shift()
							expect(removed).toBeUndefined()
						})
					})

					test("shift then mutate remaining items", () => {
						const base = {items: [{id: 1}, {id: 2, value: 10}]}
						const result = produce(base, draft => {
							draft.items.shift()
							draft.items[0].value = 20
						})
						expect(result.items).toHaveLength(1)
						expect(result.items[0].value).toBe(20)
					})

					test("multiple shifts", () => {
						const base = {items: [{id: 1}, {id: 2}, {id: 3}]}
						const result = produce(base, draft => {
							draft.items.shift()
							draft.items.shift()
						})
						expect(result.items).toHaveLength(1)
						expect(result.items[0].id).toBe(3)
					})
				})

				describe("splice() edge cases", () => {
					test("splice with only deleteCount (no items to add)", () => {
						const base = {items: [{id: 1}, {id: 2}, {id: 3}, {id: 4}]}
						const result = produce(base, draft => {
							const removed = draft.items.splice(1, 2)
							expect(removed).toHaveLength(2)
							expect(removed[0].id).toBe(2)
						})
						expect(result.items).toHaveLength(2)
						expect(result.items[0].id).toBe(1)
						expect(result.items[1].id).toBe(4)
					})

					test("splice with negative start index", () => {
						const base = {items: [{id: 1}, {id: 2}, {id: 3}]}
						const result = produce(base, draft => {
							draft.items.splice(-1, 1, {id: 99})
						})
						expect(result.items[2].id).toBe(99)
					})

					test("splice at start (index 0)", () => {
						const base = {items: [{id: 1}, {id: 2}]}
						const result = produce(base, draft => {
							draft.items.splice(0, 0, {id: 0})
						})
						expect(result.items[0].id).toBe(0)
						expect(result.items).toHaveLength(3)
					})

					test("splice at end", () => {
						const base = {items: [{id: 1}, {id: 2}]}
						const result = produce(base, draft => {
							draft.items.splice(2, 0, {id: 3})
						})
						expect(result.items[2].id).toBe(3)
					})

					test("splice then mutate spliced-in items", () => {
						const base = {items: [{id: 1}, {id: 3}]}
						const result = produce(base, draft => {
							draft.items.splice(1, 0, {id: 2, value: 10})
							draft.items[1].value = 20
						})
						expect(result.items[1].value).toBe(20)
					})
				})

				describe("combined operations", () => {
					test("sort then push", () => {
						const base = {items: [{value: 3}, {value: 1}]}
						const result = produce(base, draft => {
							draft.items.sort((a, b) => a.value - b.value)
							draft.items.push({value: 4})
						})
						expect(result.items.map(i => i.value)).toEqual([1, 3, 4])
					})

					test("reverse then unshift", () => {
						const base = {items: [{id: 1}, {id: 2}, {id: 3}]}
						const result = produce(base, draft => {
							draft.items.reverse()
							draft.items.unshift({id: 0})
						})
						expect(result.items.map(i => i.id)).toEqual([0, 3, 2, 1])
					})

					test("splice then sort", () => {
						const base = {items: [{value: 5}, {value: 2}, {value: 8}]}
						const result = produce(base, draft => {
							draft.items.splice(1, 1, {value: 1})
							draft.items.sort((a, b) => a.value - b.value)
						})
						expect(result.items.map(i => i.value)).toEqual([1, 5, 8])
					})

					test("push, pop, push sequence", () => {
						const base = {items: [{id: 1}]}
						const result = produce(base, draft => {
							draft.items.push({id: 2})
							draft.items.pop()
							draft.items.push({id: 3})
						})
						expect(result.items.map(i => i.id)).toEqual([1, 3])
					})
				})

				describe("bulk operations with pre-existing proxies", () => {
					test("access items before sort", () => {
						const base = {items: [{value: 3}, {value: 1}, {value: 2}]}
						const result = produce(base, draft => {
							// Access all items to create proxies
							draft.items.forEach(item => item.value)
							// Then sort
							draft.items.sort((a, b) => a.value - b.value)
						})
						expect(result.items.map(i => i.value)).toEqual([1, 2, 3])
					})

					test("mutate items before reverse", () => {
						const base = {
							items: [
								{id: 1, value: 10},
								{id: 2, value: 20}
							]
						}
						const result = produce(base, draft => {
							// Mutate to create modified proxies
							draft.items[0].value = 15
							draft.items[1].value = 25
							// Then reverse
							draft.items.reverse()
						})
						expect(result.items[0].id).toBe(2)
						expect(result.items[0].value).toBe(25)
						expect(result.items[1].id).toBe(1)
						expect(result.items[1].value).toBe(15)
					})
				})

				describe("return values", () => {
					test("pop returns removed item", () => {
						const base = {items: [{id: 1}, {id: 2}]}
						produce(base, draft => {
							const removed = draft.items.pop()
							expect(removed.id).toBe(2)
							// Verify we can mutate the returned item
							removed.modified = true
							expect(draft.items[0].modified).toBeUndefined()
						})
					})

					test("shift returns removed item", () => {
						const base = {items: [{id: 1}, {id: 2}]}
						produce(base, draft => {
							const removed = draft.items.shift()
							expect(removed.id).toBe(1)
						})
					})

					test("splice returns array of removed items", () => {
						const base = {items: [{id: 1}, {id: 2}, {id: 3}]}
						produce(base, draft => {
							const removed = draft.items.splice(0, 2)
							expect(removed).toHaveLength(2)
							expect(removed[0].id).toBe(1)
							expect(removed[1].id).toBe(2)
						})
					})
				})
			})

			describe("non-mutating array methods", () => {
				// Test data factory
				const createTestData = () => ({
					items: [
						{id: 1, value: 10, nested: {count: 1}},
						{id: 2, value: 20, nested: {count: 2}},
						{id: 3, value: 30, nested: {count: 3}},
						{id: 4, value: 40, nested: {count: 4}},
						{id: 5, value: 50, nested: {count: 5}}
					],
					other: {data: "test"}
				})

				describe("filter()", () => {
					test("returns new array with filtered items", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const filtered = draft.items.filter(item => item.value > 25)
							expect(filtered).toHaveLength(3)
							expect(filtered[0].id).toBe(3)
						})
						expect(result).toBe(base) // No modifications
					})

					test("mutations to filtered items are reflected in result", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const filtered = draft.items.filter(item => item.value > 25)
							// Verify filtered items are drafts
							expect(isDraft(filtered[0])).toBe(true)
							filtered[0].value = 999
						})
						expect(result.items[2].value).toBe(999) // id: 3 is at index 2
						expect(result.items[0].value).toBe(10) // Unchanged
						// Verify base state unchanged
						expect(base.items[2].value).toBe(30)
						// Verify result is a copy
						expect(result.items[2]).not.toBe(base.items[2])
					})

					test("mutations to nested properties work correctly", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const filtered = draft.items.filter(item => item.id > 2)
							// Verify filtered items are drafts
							expect(isDraft(filtered[0])).toBe(true)
							filtered[0].nested.count = 100
						})
						expect(result.items[2].nested.count).toBe(100)
						// Verify base state unchanged
						expect(base.items[2].nested.count).toBe(3)
						// Verify result is a copy
						expect(result.items[2].nested).not.toBe(base.items[2].nested)
					})

					test("multiple mutations to different filtered items", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const filtered = draft.items.filter(item => item.value > 15)
							// Verify all filtered items are drafts
							filtered.forEach(item => expect(isDraft(item)).toBe(true))
							filtered[0].value = 200 // id: 2
							filtered[1].value = 300 // id: 3
							filtered[2].value = 400 // id: 4
						})
						expect(result.items[1].value).toBe(200)
						expect(result.items[2].value).toBe(300)
						expect(result.items[3].value).toBe(400)
						// Verify base state unchanged
						expect(base.items[1].value).toBe(20)
						expect(base.items[2].value).toBe(30)
						expect(base.items[3].value).toBe(40)
					})

					test("filtered array can be assigned to another property", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const filtered = draft.items.filter(item => item.value > 25)
							draft.other.filtered = filtered
						})
						expect(result.other.filtered).toHaveLength(3)
						expect(result.other.filtered[0].id).toBe(3)
					})

					test("cross-reference: mutating filtered item affects original location", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const filtered = draft.items.filter(item => item.id === 3)
							draft.other.ref = filtered[0]
							filtered[0].value = 999
						})
						expect(result.items[2].value).toBe(999)
						expect(result.other.ref.value).toBe(999)
					})

					test("read-only access doesn't cause mutations", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const filtered = draft.items.filter(item => item.value > 25)
							const sum = filtered.reduce((acc, item) => acc + item.value, 0)
							expect(sum).toBe(120) // 30 + 40 + 50
						})
						expect(result).toBe(base) // No modifications
					})
				})

				describe("map()", () => {
					test("returns new array with mapped items", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const mapped = draft.items.map(item => item.nested)
							expect(mapped).toHaveLength(5)
							expect(mapped[0].count).toBe(1)
						})
						expect(result).toBe(base)
					})

					test("mutations to mapped nested objects work", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const nested = draft.items.map(item => item.nested)
							// Verify mapped items are drafts
							expect(isDraft(nested[0])).toBe(true)
							nested[0].count = 100
						})
						expect(result.items[0].nested.count).toBe(100)
						// Verify base state unchanged
						expect(base.items[0].nested.count).toBe(1)
						// Verify result is a copy
						expect(result.items[0].nested).not.toBe(base.items[0].nested)
					})

					test("map with transformation then mutate", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const mapped = draft.items.map(item => ({
								...item,
								doubled: item.value * 2
							}))
							// This creates new objects, so mutations won't affect original
							mapped[0].value = 999
						})
						expect(result.items[0].value).toBe(10) // Unchanged
					})

					test("map returning original items allows mutation", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const mapped = draft.items.map(item => item) // Identity map
							// Verify mapped items are drafts
							expect(isDraft(mapped[0])).toBe(true)
							mapped[0].value = 999
						})
						expect(result.items[0].value).toBe(999)
						// Verify base state unchanged
						expect(base.items[0].value).toBe(10)
						// Verify result is a copy
						expect(result.items[0]).not.toBe(base.items[0])
					})
				})

				describe("find()", () => {
					test("returns found item", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const found = draft.items.find(item => item.id === 3)
							expect(found?.value).toBe(30)
						})
						expect(result).toBe(base)
					})

					test("mutations to found item are reflected", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const found = draft.items.find(item => item.id === 3)
							// Verify found item is a draft
							expect(isDraft(found)).toBe(true)
							if (found) {
								found.value = 999
							}
						})
						expect(result.items[2].value).toBe(999)
						// Verify base state unchanged
						expect(base.items[2].value).toBe(30)
						// Verify result is a copy
						expect(result.items[2]).not.toBe(base.items[2])
					})

					test("nested mutations on found item", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const found = draft.items.find(item => item.id === 2)
							// Verify found item is a draft
							expect(isDraft(found)).toBe(true)
							if (found) {
								found.nested.count = 200
							}
						})
						expect(result.items[1].nested.count).toBe(200)
						// Verify base state unchanged
						expect(base.items[1].nested.count).toBe(2)
						// Verify result is a copy
						expect(result.items[1].nested).not.toBe(base.items[1].nested)
					})

					test("find returns undefined when not found", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const found = draft.items.find(item => item.id === 999)
							expect(found).toBeUndefined()
						})
						expect(result).toBe(base)
					})
				})

				describe("findLast()", () => {
					test("returns last matching item", () => {
						const base = {
							items: [
								{id: 1, type: "A"},
								{id: 2, type: "B"},
								{id: 3, type: "A"}
							]
						}
						const result = produce(base, draft => {
							const found = draft.items.findLast(item => item.type === "A")
							expect(found?.id).toBe(3)
						})
						expect(result).toBe(base)
					})

					test("mutations to findLast result work", () => {
						const base = {
							items: [
								{id: 1, type: "A", value: 10},
								{id: 2, type: "B", value: 20},
								{id: 3, type: "A", value: 30}
							]
						}
						const result = produce(base, draft => {
							const found = draft.items.findLast(item => item.type === "A")
							// Verify found item is a draft
							expect(isDraft(found)).toBe(true)
							if (found) {
								found.value = 999
							}
						})
						expect(result.items[2].value).toBe(999)
						// Verify base state unchanged
						expect(base.items[2].value).toBe(30)
						// Verify result is a copy
						expect(result.items[2]).not.toBe(base.items[2])
					})
				})

				describe("slice()", () => {
					test("returns sliced array", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const sliced = draft.items.slice(1, 3)
							expect(sliced).toHaveLength(2)
							expect(sliced[0].id).toBe(2)
						})
						expect(result).toBe(base)
					})

					test("mutations to sliced items work", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const sliced = draft.items.slice(1, 3)
							// Verify sliced items are drafts
							expect(isDraft(sliced[0])).toBe(true)
							sliced[0].value = 999
						})
						expect(result.items[1].value).toBe(999)
						// Verify base state unchanged
						expect(base.items[1].value).toBe(20)
						// Verify result is a copy
						expect(result.items[1]).not.toBe(base.items[1])
					})

					test("slice with negative indices", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const sliced = draft.items.slice(-2)
							// Verify sliced items are drafts
							expect(isDraft(sliced[0])).toBe(true)
							sliced[0].value = 999
						})
						expect(result.items[3].value).toBe(999)
						// Verify base state unchanged
						expect(base.items[3].value).toBe(40)
						// Verify result is a copy
						expect(result.items[3]).not.toBe(base.items[3])
					})
				})

				describe("flatMap()", () => {
					test("returns flattened array", () => {
						const base = {
							groups: [{items: [{id: 1}, {id: 2}]}, {items: [{id: 3}, {id: 4}]}]
						}
						const result = produce(base, draft => {
							const flat = draft.groups.flatMap(group => group.items)
							expect(flat).toHaveLength(4)
							expect(flat[0].id).toBe(1)
						})
						expect(result).toBe(base)
					})

					test("mutations to flatMapped items work", () => {
						const base = {
							groups: [
								{
									items: [
										{id: 1, value: 10},
										{id: 2, value: 20}
									]
								},
								{items: [{id: 3, value: 30}]}
							]
						}
						const result = produce(base, draft => {
							const flat = draft.groups.flatMap(group => group.items)
							// Verify flatMapped items are drafts
							expect(isDraft(flat[0])).toBe(true)
							flat[0].value = 999
						})
						expect(result.groups[0].items[0].value).toBe(999)
						// Verify base state unchanged
						expect(base.groups[0].items[0].value).toBe(10)
						// Verify result is a copy
						expect(result.groups[0].items[0]).not.toBe(base.groups[0].items[0])
					})
				})

				describe("reduce()", () => {
					test("returns accumulated value", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const sum = draft.items.reduce((acc, item) => acc + item.value, 0)
							expect(sum).toBe(150) // 10 + 20 + 30 + 40 + 50
						})
						expect(result).toBe(base)
					})

					test("mutations during reduce are reflected", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const sum = draft.items.reduce((acc, item, index) => {
								// Verify items in reduce are drafts
								expect(isDraft(item)).toBe(true)
								if (index === 2) {
									item.value = 999
								}
								return acc + item.value
							}, 0)
							expect(sum).toBe(1119) // 10 + 20 + 999 + 40 + 50
						})
						expect(result.items[2].value).toBe(999)
						// Verify base state unchanged
						expect(base.items[2].value).toBe(30)
						// Verify result is a copy
						expect(result.items[2]).not.toBe(base.items[2])
					})

					test("reduce with object accumulator", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const grouped = draft.items.reduce((acc, item) => {
								const key = item.value > 25 ? "high" : "low"
								if (!acc[key]) acc[key] = []
								acc[key].push(item)
								return acc
							}, {})
							expect(grouped.low).toHaveLength(2)
							expect(grouped.high).toHaveLength(3)
						})
						expect(result).toBe(base)
					})

					test("reduce then mutate accumulated items", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const items = draft.items.reduce((acc, item) => {
								// Verify items in reduce are drafts
								expect(isDraft(item)).toBe(true)
								if (item.value > 25) acc.push(item)
								return acc
							}, [])
							// Verify accumulated items are drafts
							expect(isDraft(items[0])).toBe(true)
							items[0].value = 999
						})
						expect(result.items[2].value).toBe(999) // id: 3 is at index 2
						// Verify base state unchanged
						expect(base.items[2].value).toBe(30)
						// Verify result is a copy
						expect(result.items[2]).not.toBe(base.items[2])
					})
				})

				describe("forEach()", () => {
					test("iterates over all items", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							let count = 0
							draft.items.forEach(item => {
								count++
								expect(item.id).toBeDefined()
							})
							expect(count).toBe(5)
						})
						expect(result).toBe(base)
					})

					test("mutations during forEach are reflected", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							draft.items.forEach((item, index) => {
								// Verify items in forEach are drafts
								expect(isDraft(item)).toBe(true)
								if (index === 1) {
									item.value = 999
								}
							})
						})
						expect(result.items[1].value).toBe(999)
						// Verify base state unchanged
						expect(base.items[1].value).toBe(20)
						// Verify result is a copy
						expect(result.items[1]).not.toBe(base.items[1])
					})

					test("forEach with nested mutations", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							draft.items.forEach(item => {
								// Verify items in forEach are drafts
								expect(isDraft(item)).toBe(true)
								item.nested.count *= 10
							})
						})
						expect(result.items[0].nested.count).toBe(10)
						expect(result.items[4].nested.count).toBe(50)
						// Verify base state unchanged
						expect(base.items[0].nested.count).toBe(1)
						// Verify result is a copy
						expect(result.items[0].nested).not.toBe(base.items[0].nested)
					})

					test("forEach returns undefined", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const returnValue = draft.items.forEach(item => item.value)
							expect(returnValue).toBeUndefined()
						})
						expect(result).toBe(base)
					})
				})

				describe("indexOf()", () => {
					test("returns index of found item", () => {
						const base = {items: [1, 2, 3, 4, 5]}
						const result = produce(base, draft => {
							const index = draft.items.indexOf(3)
							expect(index).toBe(2)
						})
						expect(result).toBe(base)
					})

					test("returns -1 when item not found", () => {
						const base = {items: [1, 2, 3, 4, 5]}
						const result = produce(base, draft => {
							const index = draft.items.indexOf(99)
							expect(index).toBe(-1)
						})
						expect(result).toBe(base)
					})

					test("works with object references", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const item = draft.items[2]
							const index = draft.items.indexOf(item)
							expect(index).toBe(2)
						})
						expect(result).toBe(base)
					})

					test("indexOf with fromIndex parameter", () => {
						const base = {items: [1, 2, 3, 2, 5]}
						const result = produce(base, draft => {
							const firstIndex = draft.items.indexOf(2)
							const secondIndex = draft.items.indexOf(2, 2)
							expect(firstIndex).toBe(1)
							expect(secondIndex).toBe(3)
						})
						expect(result).toBe(base)
					})
				})

				describe("join()", () => {
					test("returns joined string", () => {
						const base = {items: [1, 2, 3, 4, 5]}
						const result = produce(base, draft => {
							const joined = draft.items.join(",")
							expect(joined).toBe("1,2,3,4,5")
						})
						expect(result).toBe(base)
					})

					test("join with custom separator", () => {
						const base = {items: ["a", "b", "c"]}
						const result = produce(base, draft => {
							const joined = draft.items.join(" - ")
							expect(joined).toBe("a - b - c")
						})
						expect(result).toBe(base)
					})

					test("join with no separator uses comma", () => {
						const base = {items: [1, 2, 3]}
						const result = produce(base, draft => {
							const joined = draft.items.join()
							expect(joined).toBe("1,2,3")
						})
						expect(result).toBe(base)
					})

					test("join with objects calls toString", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const joined = draft.items.join(",")
							expect(joined).toContain("[object Object]")
						})
						expect(result).toBe(base)
					})
				})

				describe("combined operations", () => {
					test("chain filter then map then mutate", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const filtered = draft.items.filter(item => item.value > 20)
							// Verify filtered items are drafts
							filtered.forEach(item => expect(isDraft(item)).toBe(true))
							const nested = filtered.map(item => item.nested)
							// Verify mapped items are drafts
							expect(isDraft(nested[0])).toBe(true)
							nested[0].count = 999
						})
						expect(result.items[2].nested.count).toBe(999)
						// Verify base state unchanged
						expect(base.items[2].nested.count).toBe(3)
						// Verify result is a copy
						expect(result.items[2].nested).not.toBe(base.items[2].nested)
					})

					test("filter, find, then mutate", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const filtered = draft.items.filter(item => item.value > 20)
							// Verify filtered items are drafts
							filtered.forEach(item => expect(isDraft(item)).toBe(true))
							const found = filtered.find(item => item.id === 4)
							// Verify found item is a draft
							expect(isDraft(found)).toBe(true)
							if (found) {
								found.value = 999
							}
						})
						expect(result.items[3].value).toBe(999)
						// Verify base state unchanged
						expect(base.items[3].value).toBe(40)
						// Verify result is a copy
						expect(result.items[3]).not.toBe(base.items[3])
					})

					test("multiple filters with mutations", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const filtered1 = draft.items.filter(item => item.value > 15)
							// Verify first filter items are drafts
							filtered1.forEach(item => expect(isDraft(item)).toBe(true))
							const filtered2 = filtered1.filter(item => item.value < 45)
							// Verify second filter items are drafts
							filtered2.forEach(item => expect(isDraft(item)).toBe(true))
							filtered2[0].value = 999
						})
						expect(result.items[1].value).toBe(999)
						// Verify base state unchanged
						expect(base.items[1].value).toBe(20)
						// Verify result is a copy
						expect(result.items[1]).not.toBe(base.items[1])
					})
				})

				describe("edge cases", () => {
					test("empty filter result", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const filtered = draft.items.filter(item => item.value > 1000)
							expect(filtered).toHaveLength(0)
						})
						expect(result).toBe(base)
					})

					test("filter with all items", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const filtered = draft.items.filter(() => true)
							filtered[0].value = 999
						})
						expect(result.items[0].value).toBe(999)
					})

					test("mutation during filter callback", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const filtered = draft.items.filter(item => {
								// Verify items in filter callback are drafts
								expect(isDraft(item)).toBe(true)
								item.touched = true
								return item.value > 25
							})
							expect(filtered).toHaveLength(3)
						})
						expect(result.items[0].touched).toBe(true)
						expect(result.items[3].touched).toBe(true)
						// Verify base state unchanged
						expect(base.items[0].touched).toBeUndefined()
					})

					test("primitive array filter", () => {
						const base = {numbers: [1, 2, 3, 4, 5]}
						const result = produce(base, draft => {
							const filtered = draft.numbers.filter(n => n > 2)
							expect(filtered).toEqual([3, 4, 5])
						})
						expect(result).toBe(base)
					})

					test("mixed draft and non-draft in filter result", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							// Mutate some items before filtering
							draft.items[0].value = 15
							draft.items[2].value = 35

							const filtered = draft.items.filter(item => item.value > 14)
							filtered[0].value = 999 // Mutate already-mutated item
						})
						expect(result.items[0].value).toBe(999)
					})

					test("assigning filtered array back to draft", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							draft.items = draft.items.filter(item => item.value > 25)
							draft.items[0].value = 999
						})
						expect(result.items).toHaveLength(3)
						expect(result.items[0].value).toBe(999)
						expect(result.items[0].id).toBe(3)
					})
				})

				describe("performance-critical patterns", () => {
					test("large array filter with read-only access", () => {
						const base = {
							items: Array.from({length: 1000}, (_, i) => ({
								id: i,
								value: i * 10
							}))
						}
						const result = produce(base, draft => {
							const filtered = draft.items.filter(item => item.value > 5000)
							const sum = filtered.reduce((acc, item) => acc + item.value, 0)
							expect(sum).toBeGreaterThan(0)
						})
						expect(result).toBe(base) // No modifications
					})

					test("multiple filters without mutations", () => {
						const base = createTestData()
						const result = produce(base, draft => {
							const f1 = draft.items.filter(item => item.value > 10)
							const f2 = draft.items.filter(item => item.value < 40)
							const f3 = draft.items.filter(item => item.id % 2 === 0)
							expect(f1.length + f2.length + f3.length).toBeGreaterThan(0)
						})
						expect(result).toBe(base)
					})
				})
			})

			it("supports the same child reference multiple times in the same array via index assignment", () => {
				const obj = {value: 1}
				const baseState = {items: [obj, {}, {}, {}, {}]}

				const nextState = produce(baseState, draft => {
					// Assign the same object to multiple indices
					draft.items[0] = obj // Original position
					draft.items[2] = obj // Same object at different index
					draft.items[4] = obj // Same object at yet another index

					// Modify the object through one of the references
					draft.items[0].value = 2
				})

				// Immer behavior: modified draft gets new object, unmodified drafts are optimized
				expect(nextState.items[0]).not.toBe(nextState.items[2]) // Modified vs unmodified
				expect(nextState.items[2]).toBe(nextState.items[4]) // Both unmodified, same reference
				expect(nextState.items[0].value).toBe(2) // Modified
				expect(nextState.items[2].value).toBe(1) // Unmodified (same as original)
				expect(nextState.items[4].value).toBe(1) // Unmodified (same as original)

				// The unmodified items should be the same as the original object
				expect(nextState.items[2]).toBe(obj)
				expect(nextState.items[4]).toBe(obj)

				// Original object should be unchanged
				expect(obj.value).toBe(1)

				// Verify array structure
				expect(nextState.items.length).toBe(5)
			})

			it("supports modifying nested objects", () => {
				const baseState = [{a: 1}, {}]
				const nextState = produce(baseState, s => {
					s[0].a++
					s[0].a++
					s[1].a = 0
					s[0].a--
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

			if (!global.USES_BUILD) {
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

			it("state stays the same if the same item is assigned by key", () => {
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
				// Non-enumerable primitive property that won't modified.
				Object.defineProperty(baseState, "baz", {
					value: 1,
					enumerable: false
				})

				// When using Proxy, even non-enumerable keys will be copied if it's changed.
				const canReferNonEnumerableProperty = useStrictShallowCopy
				const nextState = produce(baseState, s => {
					if (canReferNonEnumerableProperty) expect(s.foo).toBeTruthy()
					if (useStrictShallowCopy) expect(isEnumerable(s, "foo")).toBeFalsy()
					if (canReferNonEnumerableProperty) s.bar++
					if (useStrictShallowCopy) expect(isEnumerable(s, "foo")).toBeFalsy()
					if (canReferNonEnumerableProperty) s.foo.a++
					if (useStrictShallowCopy) expect(isEnumerable(s, "foo")).toBeFalsy()
				})
				if (canReferNonEnumerableProperty) {
					expect(nextState.foo).toEqual({a: 2})
				}
				if (useStrictShallowCopy)
					expect(isEnumerable(nextState, "foo")).toBeFalsy()
				if (useStrictShallowCopy) expect(nextState.baz).toBeTruthy()
			})

		it("can work with own computed props", () => {
			const baseState = {
				x: 1,
				get y() {
					return this.x
				},
				set y(v) {
					this.x = v
				}
			}

			const nextState = produce(baseState, d => {
				expect(d.y).toBe(1)
				d.x = 2
				expect(d.x).toBe(2)
				expect(d.y).toBe(1) // this has been copied!
				d.y = 3
				expect(d.x).toBe(2)
			})
			expect(baseState.x).toBe(1)
			expect(baseState.y).toBe(1)

			expect(nextState.x).toBe(2)
			expect(nextState.y).toBe(3)
			if (!autoFreeze) {
				nextState.y = 4 // decoupled now!
				expect(nextState.y).toBe(4)
				expect(nextState.x).toBe(2)
				expect(Object.getOwnPropertyDescriptor(nextState, "y").value).toBe(4)
			}
		})

		it("can work with class with computed props", () => {
			class State {
				[immerable] = true

				x = 1

				set y(v) {
					this.x = v
				}

				get y() {
					return this.x
				}
			}

			const baseState = new State()

			const nextState = produce(baseState, d => {
				expect(d.y).toBe(1)
				d.y = 2
				expect(d.x).toBe(2)
				expect(d.y).toBe(2)
				expect(Object.getOwnPropertyDescriptor(d, "y")).toBeUndefined()
			})
			expect(baseState.x).toBe(1)
			expect(baseState.y).toBe(1)

			expect(nextState.x).toBe(2)
			expect(nextState.y).toBe(2)
			expect(Object.getOwnPropertyDescriptor(nextState, "y")).toBeUndefined()
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
			proto[immerable] = true
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
			const obj = {notEmpty: true}
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
		if (!isProd)
			it("revokes the draft once produce returns", () => {
				const expectRevoked = fn => {
					expect(fn).toThrowErrorMatchingSnapshot()
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
				})

				// Assign unknown property on object draft.
				expectRevoked(() => {
					draft.z = true
				})

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
				})

				// Assign unknown index of an array draft.
				expectRevoked(() => {
					draft[1] = true
				})
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
			// 0 === -0 // true
			// Object.is(0, -0) // false
			//
			// MWE:
			// Immer preserves the difference between -0 and +0,
			// so a new state is created.
			// This isn't defined anywhere explicitly, so could be changed
			// in the future to follow === behavior, rather than Object.is.
			// But I think this is fine as is.
			expect(nextState).not.toBe(baseState)
			expect(nextState.x).toBe(-0)
			expect(nextState.x).not.toBe(+0)
			// however, toEqual treats -0 === +0 (which is true!)
			expect(nextState).toEqual(baseState)
		})

		it("should handle equality correctly - 3", () => {
			const baseState = {
				x: "s1",
				y: 1,
				z: NaN
			}
			const nextState = produce(baseState, draft => {
				draft.x = "s2"
				draft.y = 1
				draft.z = NaN
				if (!isProd) {
					expect(draft[DRAFT_STATE].assigned_.get("x")).toBe(true)
					expect(draft[DRAFT_STATE].assigned_.get("y")).toBe(undefined)
					expect(draft[DRAFT_STATE].assigned_.get("z")).toBe(undefined)
				}
			})
			expect(nextState.x).toBe("s2")
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
				const options = {autoFreeze}
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
			test("issue #462 - frozen", () => {
				var origin = {
					a: {
						value: "no"
					},
					b: {
						value: "no"
					}
				}
				const next = produce(origin, draft => {
					draft.a.value = "im"
				})
				expect(() => {
					origin.b.value = "yes"
				}).toThrowError(
					"Cannot assign to read only property 'value' of object '#<Object>'"
				)
				expect(() => {
					next.b.value = "yes"
				}).toThrowError(
					"Cannot assign to read only property 'value' of object '#<Object>'"
				) // should throw!
			})

		autoFreeze &&
			test("issue #1190 / #1192 - should not freeze non-draftable objects (class instances and typed arrays)", () => {
				class MutableClass {
					value = 5
				}

				const state = {
					someValue: 5,
					mutableClass: new MutableClass(),
					typedArray: new Uint8Array(10)
				}

				expect(() => {
					// Should not throw when producing with autoFreeze enabled
					const result = produce(state, draft => {
						draft.someValue = 6
					})

					// Verify the non-draftable class instance is not frozen
					state.mutableClass.value = 6
				}).not.toThrow()
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

			// As of the finalization callback rewrite, the
			// the original `() => res.self` check passes without throwing,
			// but we still will not have self-references
			// when returning updated values
			it("can return self-references, but not for modified values", () => {
				const res = {}
				res.self = res

				// the call will pass
				const next = produce(res, draft => {
					draft.a = 42
					draft.self.b = 99
				})

				// Root object and first child were both copied
				expect(next).not.toBe(next.self)
				// Second child is the first circular reference
				expect(next.self.self).not.toBe(next.self)
				// And it's turtles all the way down
				expect(next.self.self.self).toBe(next.self.self.self.self)
				expect(next.a).toBe(42)
				expect(next.self.b).toBe(99)
				// The child copy did not receive the update
				// to the root object
				expect(next.self.a).toBe(undefined)
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

		it("cannot always detect noop assignments - 4", () => {
			const baseState = {}
			const [nextState, patches] = produceWithPatches(baseState, d => {
				d.x = 4
				delete d.x
			})
			expect(nextState).toEqual({})
			expect(patches).toEqual([])
			// This differs between ES5 and proxy, and ES5 does it better :(
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
			const object = produce([], () => Object.create(null))
			expect(isDraft(object)).toBeFalsy()
		})
		it("returns false for arrays returned by the producer", () => {
			const array = produce({}, _ => [])
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

	if (!autoFreeze) {
		test("#613", () => {
			const x1 = {}
			const y1 = produce(x1, draft => {
				draft.foo = produce({bar: "baz"}, draft1 => {
					draft1.bar = "baa"
				})
				draft.foo.bar = "a"
			})
			expect(y1.foo.bar).toBe("a")
		})
	}
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

	describe("class with getters", () => {
		class State {
			[immerable] = true
			_bar = {baz: 1}
			foo
			get bar() {
				return this._bar
			}
			syncFoo() {
				const value = this.bar.baz
				this.foo = value
				this.bar.baz++
			}
		}
		const state = new State()

		it("should use a method to assing a field using a getter that return a non primitive object", () => {
			const newState = produce(state, draft => {
				draft.syncFoo()
			})
			expect(newState.foo).toEqual(1)
			expect(newState.bar).toEqual({baz: 2})
			expect(state.bar).toEqual({baz: 1})
		})
	})

	describe("super class with getters", () => {
		class BaseState {
			[immerable] = true
			_bar = {baz: 1}
			foo
			get bar() {
				return this._bar
			}
			syncFoo() {
				const value = this.bar.baz
				this.foo = value
				this.bar.baz++
			}
		}

		class State extends BaseState {}

		const state = new State()

		it("should use a method to assing a field using a getter that return a non primitive object", () => {
			const newState = produce(state, draft => {
				draft.syncFoo()
			})
			expect(newState.foo).toEqual(1)
			expect(newState.bar).toEqual({baz: 2})
			expect(state.bar).toEqual({baz: 1})
		})
	})

	describe("class with setters", () => {
		class State {
			[immerable] = true
			_bar = 0
			get bar() {
				return this._bar
			}
			set bar(x) {
				this._bar = x
			}
		}
		const state = new State()

		it("should define a field with a setter", () => {
			const newState3 = produce(state, d => {
				d.bar = 1
				expect(d._bar).toEqual(1)
			})
			expect(newState3._bar).toEqual(1)
			expect(newState3.bar).toEqual(1)
			expect(state._bar).toEqual(0)
			expect(state.bar).toEqual(0)
		})
	})

	test("setter only", () => {
		let setterCalled = 0
		class State {
			[immerable] = true
			x = 0
			set y(value) {
				setterCalled++
				this.x = value
			}
		}

		const state = new State()
		const next = produce(state, draft => {
			expect(draft.y).toBeUndefined()
			draft.y = 2 // setter is inherited, so works
			expect(draft.x).toBe(2)
		})
		expect(setterCalled).toBe(1)
		expect(next.x).toBe(2)
		expect(state.x).toBe(0)
	})

	test("getter only", () => {
		let getterCalled = 0
		class State {
			[immerable] = true
			x = 0
			get y() {
				getterCalled++
				return this.x
			}
		}

		const state = new State()
		const next = produce(state, draft => {
			expect(draft.y).toBe(0)
			expect(() => {
				draft.y = 2
			}).toThrow("Cannot set property y")
			draft.x = 2
			expect(draft.y).toBe(2)
		})
		expect(next.x).toBe(2)
		expect(next.y).toBe(2)
		expect(state.x).toBe(0)
	})

	test("own setter only", () => {
		let setterCalled = 0
		const state = {
			x: 0,
			set y(value) {
				setterCalled++
				this.x = value
			}
		}

		const next = produce(state, draft => {
			expect(draft.y).toBeUndefined()
			// setter is not preserved, so we can write
			draft.y = 2
			expect(draft.x).toBe(0)
			expect(draft.y).toBe(2)
		})
		expect(setterCalled).toBe(0)
		expect(next.x).toBe(0)
		expect(next.y).toBe(2)
		expect(state.x).toBe(0)
	})

	test("own getter only", () => {
		let getterCalled = 0
		const state = {
			x: 0,
			get y() {
				getterCalled++
				return this.x
			}
		}

		const next = produce(state, draft => {
			expect(draft.y).toBe(0)
			// de-referenced, so stores it locally
			draft.y = 2
			expect(draft.y).toBe(2)
			expect(draft.x).toBe(0)
		})
		expect(getterCalled).not.toBe(1)
		expect(next.x).toBe(0)
		expect(next.y).toBe(2)
		expect(state.x).toBe(0)
	})

	test("#620", () => {
		const customSymbol = Symbol("customSymbol")

		class TestClass {
			[immerable] = true;
			[customSymbol] = 1
		}

		/* Create class instance */
		let test0 = new TestClass()

		/* First produce. This works */
		let test1 = produce(test0, draft => {
			expect(draft[customSymbol]).toBe(1)
			draft[customSymbol] = 2
		})
		expect(test1).toEqual({
			[immerable]: true,
			[customSymbol]: 2
		})

		/* Second produce. This does NOT work. See console error */
		/* With version 6.0.9, this works though */
		let test2 = produce(test1, draft => {
			expect(draft[customSymbol]).toBe(2)
			draft[customSymbol] = 3
		})
		expect(test2).toEqual({
			[immerable]: true,
			[customSymbol]: 3
		})
	})

	test("#1096 / #1087 / proxies", () => {
		const sym = Symbol()

		let state = {
			id: 1,
			[sym]: {x: 2}
		}

		state = produce(state, draft => {
			draft.id = 2
			draft[sym]
		})

		expect(state[sym].x).toBe(2)
	})
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

			if (value && typeof value == "object") {
				it("does not return a copy when changes are made", () => {
					expect(() =>
						produce(value, draft => {
							draft.foo = true
						})
					).toThrowError(
						isProd
							? "[Immer] minified error nr: 1"
							: "produce can only be called on things that are draftable"
					)
				})
			} else {
				it("does not create a draft", () => {
					produce(value, draft => {
						expect(draft).toBe(value)
					})
				})

				it("returns the base state when no changes are made", () => {
					expect(produce(value, () => {})).toBe(value)
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
