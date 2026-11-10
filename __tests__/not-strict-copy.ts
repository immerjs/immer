import {
	Immer,
	immerable,
	produce,
	setUseStrictShallowCopy,
	setAutoFreeze,
	StrictMode
} from "../src/immer"

describe.each([true, false, "class_only" as const])(
	"setUseStrictShallowCopy(true)",
	(strictMode: StrictMode) => {
		test("keep descriptors, mode: " + strictMode, () => {
			setUseStrictShallowCopy(strictMode)

			const base: Record<string, unknown> = {}
			Object.defineProperty(base, "foo", {
				value: "foo",
				writable: false,
				configurable: false
			})
			const copy = produce(base, (draft: any) => {
				draft.bar = "bar"
			})
			if (strictMode === true) {
				expect(Object.getOwnPropertyDescriptor(copy, "foo")).toStrictEqual(
					Object.getOwnPropertyDescriptor(base, "foo")
				)
			} else {
				expect(Object.getOwnPropertyDescriptor(copy, "foo")).toBeUndefined()
			}
		})

		test("keep non-enumerable class descriptors, mode: " + strictMode, () => {
			setUseStrictShallowCopy(strictMode)
			setAutoFreeze(false)

			class X {
				[immerable] = true
				foo = "foo"
				bar!: string
				constructor() {
					Object.defineProperty(this, "bar", {
						get() {
							return this.foo + "bar"
						},
						configurable: false,
						enumerable: false
					})
				}

				get baz() {
					return this.foo + "baz"
				}
			}

			const copy = produce(new X(), (draft: any) => {
				draft.foo = "FOO"
			})

			const strict = strictMode === true || strictMode === "class_only"

			// descriptors on the prototype are unaffected, so this is still a getter
			expect(copy.baz).toBe("FOObaz")
			// descriptors on the instance are found, even when non-enumerable, and read during copy
			// so new values won't be reflected
			expect(copy.bar).toBe(strict ? "foobar" : undefined)

			copy.foo = "fluff"
			// not updated, the own prop became a value
			expect(copy.bar).toBe(strict ? "foobar" : undefined)
			// updated, it is still a getter
			expect(copy.baz).toBe("fluffbaz")
		})
	}
)

test("honors the constructor class_only shallow copy mode", () => {
	const immer = new Immer({useStrictShallowCopy: "class_only"})

	class Example {
		[immerable] = true
		count = 0
	}

	const instance = new Example()
	const plain = {count: 0}
	Object.defineProperty(instance, "hidden", {value: 42})
	Object.defineProperty(plain, "hidden", {value: 42})

	const nextInstance = immer.produce(instance, draft => {
		draft.count++
	})
	const nextPlain = immer.produce(plain, draft => {
		draft.count++
	})

	expect(Object.getOwnPropertyDescriptor(nextInstance, "hidden")?.value).toBe(
		42
	)
	expect(Object.hasOwn(nextPlain, "hidden")).toBe(false)
})
