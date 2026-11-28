import {expect, test} from "vitest"
import {detectProduction} from "../src/utils/production"

test("detectProduction reads NODE_ENV", () => {
	const original = process.env.NODE_ENV
	try {
		process.env.NODE_ENV = "production"
		expect(detectProduction()).toBe(true)
		process.env.NODE_ENV = "development"
		expect(detectProduction()).toBe(false)
	} finally {
		process.env.NODE_ENV = original
	}
})

test("detectProduction is false when there is no process global", () => {
	const original = (globalThis as any).process
	delete (globalThis as any).process
	let result: boolean
	try {
		result = detectProduction()
	} finally {
		;(globalThis as any).process = original
	}
	expect(result).toBe(false)
})
