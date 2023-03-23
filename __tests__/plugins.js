import {produce, produceWithPatches, applyPatches} from "../src/immer"

test("error when using Maps", () => {
	expect(() => {
		produce(new Map(), function() {})
	}).toThrowErrorMatchingSnapshot()
})

test("error when using patches - 1", () => {
	expect(() => {
		produce(
			{},
			function() {},
			function() {}
		)
	}).toThrowErrorMatchingSnapshot()
})

test("error when using patches - 2", () => {
	expect(() => {
		produceWithPatches({}, function() {})
	}).toThrowErrorMatchingSnapshot()
})

test("error when using patches - 3", () => {
	expect(() => {
		applyPatches({}, [])
	}).toThrowErrorMatchingSnapshot()
})
