"use strict"
import {
	produce,
	current,
	isDraft,
	setUseStrictIteration,
	setUseStrictShallowCopy
} from "../src/immer"

const PARENT = Symbol("parent")

function makeFamily() {
	const parent = {name: "parent", children: []}
	const child = {name: "child"}
	child[PARENT] = parent
	parent.children.push(child)
	return {parent, child}
}

describe("#1106 pre-existing symbol circular references", () => {
	afterEach(() => {
		setUseStrictIteration(false)
		setUseStrictShallowCopy(false)
	})

	it("produce can update a parent without overflowing", () => {
		const {parent} = makeFamily()
		const next = produce(parent, draft => {
			draft.name = "updated"
		})
		expect(next.name).toBe("updated")
		expect(next).not.toBe(parent)
		expect(isDraft(next)).toBe(false)
		expect(isDraft(next.children[0])).toBe(false)
	})

	it("produce can update a nested child without overflowing", () => {
		const {parent} = makeFamily()
		const next = produce(parent, draft => {
			draft.children[0].name = "updated"
		})
		expect(next.children[0].name).toBe("updated")
		expect(next.children[0]).not.toBe(parent.children[0])
		expect(isDraft(next)).toBe(false)
		expect(isDraft(next.children[0])).toBe(false)
	})

	it("produce can use the child as the root without overflowing", () => {
		const {child, parent} = makeFamily()
		const next = produce(child, draft => {
			draft.name = "updated"
		})
		expect(next.name).toBe("updated")
		expect(next).not.toBe(child)
		expect(isDraft(next)).toBe(false)
		expect(next[PARENT]).toBe(parent)
	})

	it("produce does not leak drafts when a pre-existing symbol is read", () => {
		const {parent} = makeFamily()
		const next = produce(parent, draft => {
			const child = draft.children[0]
			void child[PARENT]
			child.name = "updated"
		})
		expect(next.children[0].name).toBe("updated")
		expect(isDraft(next)).toBe(false)
		expect(isDraft(next.children[0])).toBe(false)
		if (next.children[0][PARENT]) {
			expect(isDraft(next.children[0][PARENT])).toBe(false)
		}
	})

	it("current() after updating the parent does not overflow", () => {
		const {parent} = makeFamily()
		const next = produce(parent, draft => {
			draft.name = "updated"
			const snap = current(draft)
			expect(isDraft(snap)).toBe(false)
			expect(snap.name).toBe("updated")
			expect(snap.children[0].name).toBe("child")
		})
		expect(next.name).toBe("updated")
	})

	it("current() after updating a nested child does not overflow", () => {
		const {parent} = makeFamily()
		produce(parent, draft => {
			draft.children[0].name = "updated"
			const snap = current(draft)
			expect(isDraft(snap)).toBe(false)
			expect(isDraft(snap.children[0])).toBe(false)
			expect(snap.children[0].name).toBe("updated")
		})
	})

	it("current() of just the child draft does not overflow", () => {
		const {parent} = makeFamily()
		produce(parent, draft => {
			draft.children[0].name = "updated"
			const snap = current(draft.children[0])
			expect(isDraft(snap)).toBe(false)
			expect(snap.name).toBe("updated")
		})
	})

	it("self-referential symbol properties do not overflow", () => {
		const obj = {n: 1}
		obj[PARENT] = obj
		const next = produce(obj, draft => {
			draft.n = 2
			const snap = current(draft)
			expect(snap.n).toBe(2)
			expect(isDraft(snap)).toBe(false)
		})
		expect(next.n).toBe(2)
	})

	it("still works when strict iteration walks symbol keys", () => {
		setUseStrictIteration(true)
		const {parent} = makeFamily()
		const next = produce(parent, draft => {
			draft.children[0].name = "updated"
			const snap = current(draft)
			expect(isDraft(snap)).toBe(false)
			expect(snap.children[0].name).toBe("updated")
		})
		expect(next.children[0].name).toBe("updated")
		expect(isDraft(next)).toBe(false)
	})

	it("still works with strict shallow copy and strict iteration", () => {
		setUseStrictShallowCopy(true)
		setUseStrictIteration(true)
		const {parent} = makeFamily()
		const next = produce(parent, draft => {
			draft.name = "updated"
			const snap = current(draft)
			expect(isDraft(snap)).toBe(false)
			expect(snap.name).toBe("updated")
		})
		expect(next.name).toBe("updated")
		expect(isDraft(next)).toBe(false)
	})

	it("symbols assigned inside a recipe still do not leak drafts", () => {
		const LINK = Symbol("link")
		const next = produce({a: {x: 1}}, draft => {
			draft.a[LINK] = draft
			draft.a.x = 2
		})
		expect(next.a.x).toBe(2)
		expect(isDraft(next)).toBe(false)
		expect(isDraft(next.a)).toBe(false)
		if (next.a[LINK]) {
			expect(isDraft(next.a[LINK])).toBe(false)
		}
	})
})
