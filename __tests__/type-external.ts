import {isType, JSONArray, JSONObject, JSONTypes} from "type-plus"
import {Draft} from "../src/types/types-external"
import {createDraft, current, original} from "../src/immer"

describe("Draft<T>", () => {
	test("can use JSONTypes as T", () => {
		type A = Draft<JSONTypes>
		isType.equal<true, JSONTypes, A>()
	})

	it("can use JSONArray as T", () => {
		type A = Draft<JSONArray>
		isType.equal<true, JSONArray, A>()
	})

	it("can use Tuple as T", () => {
		type A = Draft<[string, number, JSONArray, JSONObject]>
		isType.equal<true, [string, number, JSONArray, JSONObject], A>()
	})
})

describe("current() typings", () => {
	test("returns non-draft type from a draft input", () => {
		type Base = Readonly<{a: boolean}>
		const base: Base = {a: true}
		const draft = createDraft<Base>(base)
		const result = current(draft)

		// Readonly base ensures Draft<Base> differs, exposing current()'s typing.
		isType.equal<true, Base, typeof result>()
	})
})

describe("original() typings", () => {
	test("returns non-draft type from a draft input", () => {
		type Base = Readonly<{a: boolean}>
		const base: Base = {a: true}
		const draft = createDraft<Base>(base)
		const result = original(draft)

		// Readonly base ensures Draft<Base> differs, exposing original()'s typing.
		isType.equal<true, Base, typeof result>()
	})
})
