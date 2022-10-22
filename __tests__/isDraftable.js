"use strict"
import {isDraftable} from "../src/immer"

test("non-plain object with undefined constructor doesn't error", () => {
	const obj = Object.create(Object.create(null))
	expect(isDraftable(obj)).toBe(false)
})
