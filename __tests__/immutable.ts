import {assert, _} from "spec.ts"
import {Immutable} from "../dist/immer.js"

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
