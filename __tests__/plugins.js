import produce, {
	setUseProxies,
	produceWithPatches,
	applyPatches
} from "../src/immer"

describe("ES5 plugins should throw if no proxies are available", () => {
	beforeEach(() => {
		setUseProxies(false)
	})

	afterEach(() => {
		setUseProxies(true)
	})

	test("error when using ES5", () => {
		expect(() => {
			produce({}, function() {})
		}).toThrowErrorMatchingSnapshot()
	})
})

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
