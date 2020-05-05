import {assert, _} from "spec.ts"
import produce, {Immutable, castImmutable, enableAllPlugins} from "../src/immer"

enableAllPlugins()

test("types are ok", () => {
	// array in tuple
	{
		let val = _ as Immutable<[string[], 1]>
		assert(val, _ as readonly [ReadonlyArray<string>, 1])
	}

	// tuple in array
	{
		let val = _ as Immutable<[string, 1][]>
		assert(val, _ as ReadonlyArray<readonly [string, 1]>)
	}

	// tuple in tuple
	{
		let val = _ as Immutable<[[string, 1], 1]>
		assert(val, _ as readonly [readonly [string, 1], 1])
	}

	// array in array
	{
		let val = _ as Immutable<string[][]>
		assert(val, _ as ReadonlyArray<ReadonlyArray<string>>)
	}

	// tuple in object
	{
		let val = _ as Immutable<{a: [string, 1]}>
		assert(val, _ as {readonly a: readonly [string, 1]})
	}

	// object in tuple
	{
		let val = _ as Immutable<[{a: string}, 1]>
		assert(val, _ as readonly [{readonly a: string}, 1])
	}

	// array in object
	{
		let val = _ as Immutable<{a: string[]}>
		assert(val, _ as {readonly a: ReadonlyArray<string>})
	}

	// object in array
	{
		let val = _ as Immutable<Array<{a: string}>>
		assert(val, _ as ReadonlyArray<{readonly a: string}>)
	}

	// object in object
	{
		let val = _ as Immutable<{a: {b: string}}>
		assert(val, _ as {readonly a: {readonly b: string}})
	}

	// Map
	{
		let val = _ as Immutable<Map<string, string>>
		assert(val, _ as ReadonlyMap<string, string>)
	}

	// Already immutable Map
	{
		let val = _ as Immutable<ReadonlyMap<string, string>>
		assert(val, _ as ReadonlyMap<string, string>)
	}

	// object in Map
	{
		let val = _ as Immutable<Map<{a: string}, {b: string}>>
		assert(val, _ as ReadonlyMap<{readonly a: string}, {readonly b: string}>)
	}

	// Set
	{
		let val = _ as Immutable<Set<string>>
		assert(val, _ as ReadonlySet<string>)
	}

	// Already immutable Set
	{
		let val = _ as Immutable<ReadonlySet<string>>
		assert(val, _ as ReadonlySet<string>)
	}

	// object in Set
	{
		let val = _ as Immutable<Set<{a: string}>>
		assert(val, _ as ReadonlySet<{readonly a: string}>)
	}

	expect(true).toBe(true)
})

test("#381 produce immutable state", () => {
	const someState = {
		todos: [
			{
				done: false
			}
		]
	}

	const immutable = castImmutable(produce(someState, _draft => {}))
	assert(
		immutable,
		_ as {readonly todos: ReadonlyArray<{readonly done: boolean}>}
	)
})

test("castImmutable preserves a value", () => {
	const x = {}
	expect(castImmutable(x)).toBe(x)
})
