import {isType, JSONTypes} from "type-plus"
import {Draft} from "../../src/types/types-external"

describe("Draft<T>", () => {
	test("can use JSONTypes as T", () => {
		type A = Draft<JSONTypes>
		isType.equal<true, JSONTypes, A>()
	})
})
