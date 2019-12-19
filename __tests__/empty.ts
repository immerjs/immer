import {produce, produceWithPatches} from "../src"

test("empty stub test", () => {
	expect(true).toBe(true)
})

test("delete 7", () => {
	debugger
	const [_, p] = produceWithPatches(new Set(["y", 1]), d => {
		d.delete("y")
	})
	expect(p.length).toBe(1)
})
