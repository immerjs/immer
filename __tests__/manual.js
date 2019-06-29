"use strict"
import {
	setUseProxies,
	createDraft,
	finishDraft,
	produce,
	isDraft
} from "../src/index"

runTests("proxy", true)
runTests("es5", false)

function runTests(name, useProxies) {
	describe("manual - " + name, () => {
		setUseProxies(useProxies)

		it("should check arguments", () => {
			expect(() => createDraft(3)).toThrowErrorMatchingSnapshot()
			const buf = new Buffer([])
			expect(() => createDraft(buf)).toThrowErrorMatchingSnapshot()
			expect(() => finishDraft({})).toThrowErrorMatchingSnapshot()
		})

		it("should support manual drafts", () => {
			const state = [{}, {}, {}]

			const draft = createDraft(state)
			draft.forEach((item, index) => {
				item.index = index
			})

			const result = finishDraft(draft)

			expect(result).not.toBe(state)
			expect(result).toEqual([{index: 0}, {index: 1}, {index: 2}])
			expect(state).toEqual([{}, {}, {}])
		})

		it("cannot modify after finish", () => {
			const state = {a: 1}

			const draft = createDraft(state)
			draft.a = 2
			expect(finishDraft(draft)).toEqual({a: 2})
			expect(() => {
				draft.a = 3
			}).toThrowErrorMatchingSnapshot()
		})

		it("should support patches drafts", () => {
			const state = {a: 1}

			const draft = createDraft(state)
			draft.a = 2
			draft.b = 3

			const listener = jest.fn()
			const result = finishDraft(draft, listener)

			expect(result).not.toBe(state)
			expect(result).toEqual({a: 2, b: 3})
			expect(listener.mock.calls).toMatchSnapshot()
		})

		it("should handle multiple create draft calls", () => {
			const state = {a: 1}

			const draft = createDraft(state)
			draft.a = 2

			const draft2 = createDraft(state)
			draft2.b = 3

			const result = finishDraft(draft)

			expect(result).not.toBe(state)
			expect(result).toEqual({a: 2})

			draft2.a = 4
			const result2 = finishDraft(draft2)
			expect(result2).not.toBe(result)
			expect(result2).toEqual({a: 4, b: 3})
		})

		it("combines with produce - 1", () => {
			const state = {a: 1}

			const draft = createDraft(state)
			draft.a = 2
			const res1 = produce(draft, d => {
				d.b = 3
			})
			draft.b = 4
			const res2 = finishDraft(draft)
			expect(res1).toEqual({a: 2, b: 3})
			expect(res2).toEqual({a: 2, b: 4})
		})

		it("combines with produce - 2", () => {
			const state = {a: 1}

			const res1 = produce(state, draft => {
				draft.b = 3
				const draft2 = createDraft(draft)
				draft.c = 4
				draft2.d = 5
				const res2 = finishDraft(draft2)
				expect(res2).toEqual({
					a: 1,
					b: 3,
					d: 5
				})
				draft.d = 2
			})
			expect(res1).toEqual({
				a: 1,
				b: 3,
				c: 4,
				d: 2
			})
		})

		it("should not finish drafts from produce", () => {
			produce({x: 1}, draft => {
				expect(() => finishDraft(draft)).toThrowErrorMatchingSnapshot()
			})
		})

		it("should not finish twice", () => {
			const draft = createDraft({a: 1})
			draft.a++
			finishDraft(draft)
			expect(() => finishDraft(draft)).toThrowErrorMatchingSnapshot()
		})

		describe("attach to existing draft", () => {
			describe("array assign", () => {
				const b = [{foo: "bar"}, {foo: "baz"}]
				const c = produce(b, bb => {
					bb[1] = createDraft({foo: "quux"})
					expect(isDraft(bb[1])).toBe(true)
				})
				expect(c.length).toEqual(2)
				expect(isDraft(c[1])).toBe(false)
			})
			describe("array push", () => {
				const b = [{foo: "bar"}, {foo: "baz"}]
				const c = produce(b, bb => {
					bb.push(createDraft({foo: "quux"}))
					expect(isDraft(bb[2])).toBe(true)
				})
				expect(c.length).toEqual(3)
				expect(isDraft(c[2])).toBe(false)
			})
			describe("object set existing", () => {
				const b = {foo: {bar: "baz"}}
				const c = produce(b, bb => {
					const foo2 = createDraft(Object.freeze({bar: "quux"}))
					expect(foo2.bar).toEqual("quux")

					foo2.bar = "zip"
					expect(foo2.bar).toEqual("zip")

					bb.foo = foo2
					expect(isDraft(bb.foo)).toBe(true)
				})
				expect(isDraft(c.foo)).toBe(false)
				expect(c.foo.bar).toEqual("zip")
			})
			describe("object set new", () => {
				const b = {foo: {bar: "baz"}}
				const c = produce(b, bb => {
					bb.bar = createDraft({baz: "quux"})
					expect(isDraft(bb.bar)).toBe(true)
				})
				expect(isDraft(c.bar)).toBe(false)
			})
		})
	})
}
