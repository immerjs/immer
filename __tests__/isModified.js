import {
	produce,
	createDraft,
	finishDraft,
	isModified,
	enableMapSet
} from "../src/immer"

enableMapSet()

describe("isModified", () => {
	it("returns false for values that are not drafts", () => {
		expect(isModified({})).toBe(false)
		expect(isModified([])).toBe(false)
		expect(isModified(null)).toBe(false)
		expect(isModified(undefined)).toBe(false)
		expect(isModified(42)).toBe(false)
		expect(isModified("draft")).toBe(false)
		const next = produce({x: 1}, draft => {
			draft.x = 2
		})
		expect(isModified(next)).toBe(false)
	})

	it("returns false for an unmodified draft", () => {
		produce({item: {count: 1}}, draft => {
			expect(isModified(draft)).toBe(false)
			expect(isModified(draft.item)).toBe(false)
		})
	})

	it("returns true after a direct modification", () => {
		produce({x: 1}, draft => {
			draft.x = 2
			expect(isModified(draft)).toBe(true)
		})
	})

	it("returns true after adding or deleting a property", () => {
		produce({x: 1}, draft => {
			draft.y = 2
			expect(isModified(draft)).toBe(true)
		})
		produce({x: 1}, draft => {
			delete draft.x
			expect(isModified(draft)).toBe(true)
		})
	})

	it("returns false when the same value is assigned back", () => {
		produce({x: 1}, draft => {
			draft.x = 1
			expect(isModified(draft)).toBe(false)
		})
	})

	it("tracks nested drafts and their parents, but not untouched siblings", () => {
		const base = {
			item: {count: 1},
			other: {count: 10}
		}
		produce(base, draft => {
			draft.item.count = 2
			expect(isModified(draft.item)).toBe(true)
			// modifications propagate to parent drafts
			expect(isModified(draft)).toBe(true)
			expect(isModified(draft.other)).toBe(false)
		})
	})

	it("tracks array modifications", () => {
		produce([1, 2, 3], draft => {
			expect(isModified(draft)).toBe(false)
			draft.push(4)
			expect(isModified(draft)).toBe(true)
		})
		produce({list: [1, 2, 3]}, draft => {
			draft.list[0] = 99
			expect(isModified(draft.list)).toBe(true)
			expect(isModified(draft)).toBe(true)
		})
	})

	it("works with manually created drafts", () => {
		const draft = createDraft({item: {count: 1}})
		expect(isModified(draft)).toBe(false)
		expect(isModified(draft.item)).toBe(false)
		draft.item.count = 2
		expect(isModified(draft.item)).toBe(true)
		expect(isModified(draft)).toBe(true)
		const next = finishDraft(draft)
		expect(next.item.count).toBe(2)
	})

	it("tracks Map and Set drafts", () => {
		const base = {
			map: new Map([["a", 1]]),
			set: new Set([1])
		}
		produce(base, draft => {
			expect(isModified(draft.map)).toBe(false)
			draft.map.set("b", 2)
			expect(isModified(draft.map)).toBe(true)
			expect(isModified(draft)).toBe(true)
			expect(isModified(draft.set)).toBe(false)
			draft.set.add(2)
			expect(isModified(draft.set)).toBe(true)
		})
	})

	it("supports the derived-data use case from the proposal", () => {
		const base = {item: {count: 1, modifiedOn: null}}
		const next = produce(base, draft => {
			draft.item.count++
			if (isModified(draft.item)) {
				draft.item.modifiedOn = "now"
			}
		})
		expect(next.item.modifiedOn).toBe("now")

		const untouched = produce(base, draft => {
			if (isModified(draft.item)) {
				draft.item.modifiedOn = "now"
			}
		})
		expect(untouched).toBe(base)
	})
})
