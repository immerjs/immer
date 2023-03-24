import {produce, setUseStrictShallowCopy} from "../src/immer"

describe("setUseStrictShallowCopy(true)", () => {
	test("keep descriptors", () => {
		setUseStrictShallowCopy(true)

		const base: Record<string, unknown> = {}
		Object.defineProperty(base, "foo", {
			value: "foo",
			writable: false,
			configurable: false
		})
		const copy = produce(base, (draft: any) => {
			draft.bar = "bar"
		})
		expect(Object.getOwnPropertyDescriptor(copy, "foo")).toStrictEqual(
			Object.getOwnPropertyDescriptor(base, "foo")
		)
	})
})

describe("setUseStrictShallowCopy(false)", () => {
	test("ignore descriptors", () => {
		setUseStrictShallowCopy(false)

		const base: Record<string, unknown> = {}
		Object.defineProperty(base, "foo", {
			value: "foo",
			writable: false,
			configurable: false
		})
		const copy = produce(base, (draft: any) => {
			draft.bar = "bar"
		})
		expect(Object.getOwnPropertyDescriptor(copy, "foo")).toBeUndefined()
	})
})
