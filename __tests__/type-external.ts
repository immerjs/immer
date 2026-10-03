import {isType, JSONArray, JSONObject, JSONTypes} from "type-plus"
import {Draft} from "../src/types/types-external"
import {createDraft, current, original, produce} from "../src/immer"

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

	it("can use recursive types containing readonly arrays as T (#839)", () => {
		// Same shape as type-fest's JsonValue
		type JsonValue = string | number | boolean | null | JsonObject | JsonArray
		type JsonObject = {[Key in string]: JsonValue} & {
			[Key in string]?: JsonValue | undefined
		}
		type JsonArray = JsonValue[] | readonly JsonValue[]

		type A = Draft<readonly JsonValue[]>
		isType.equal<true, Draft<JsonValue>[], A>()

		const base: {readonly items: readonly JsonValue[]} = {items: []}
		produce(base, draft => {
			draft.items.push({a: [1, "b"]})
		})
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
