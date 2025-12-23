import {isType, JSONArray, JSONObject, JSONTypes} from "type-plus"
import {Draft} from "../src/types/types-external"

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
