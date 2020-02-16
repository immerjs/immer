import {assert, _} from "spec.ts"
import produce, {
	Draft,
	castDraft,
	original,
	enableAllPlugins
} from "../src/immer"

enableAllPlugins()

// For checking if a type is assignable to its draft type (and vice versa)
const toDraft: <T>(value: T) => Draft<T> = x => x as any
const fromDraft: <T>(draft: Draft<T>) => T = x => x as any

test("draft.ts", () => {
	// DraftArray<T>
	{
		// NOTE: As of 3.2.2, everything fails without "extends any"
		;<Value extends any>(val: ReadonlyArray<Value>) => {
			val = _ as Draft<typeof val>
			let elem: Value = _ as Draft<Value>
		}
	}

	// Tuple
	{
		let val: [1, 2] = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Tuple (nested in a tuple)
	{
		let val: [[1, 2]] = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Tuple (nested in two mutable arrays)
	{
		let val: [1, 2][][] = _
		let draft: typeof val = _
		val = assert(toDraft(val), draft)
		assert(fromDraft(draft), val)
	}

	// Tuple (nested in two readonly arrays)
	{
		let val: ReadonlyArray<ReadonlyArray<[1, 2]>> = _
		let draft: [1, 2][][] = _
		val = assert(toDraft(val), draft)
	}

	// Readonly tuple
	{
		// TODO: Uncomment this when readonly tuples are supported.
		//       More info: https://stackoverflow.com/a/53822074/2228559
		// let val: Readonly<[1, 2]> = _
		// let draft: [1, 2] = _
		// draft = assert(toDraft(val), draft)
		// val = fromDraft(draft)
	}

	// Mutable array
	{
		let val: string[] = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Mutable array (nested in tuple)
	{
		let val: [string[]] = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Readonly array
	{
		let val: ReadonlyArray<string> = _
		let draft: string[] = _
		val = assert(toDraft(val), draft)
		fromDraft(draft)
	}

	// Readonly array (nested in readonly object)
	{
		let val: {readonly a: ReadonlyArray<string>} = _
		let draft: {a: string[]} = _
		val = assert(toDraft(val), draft)
		fromDraft(draft)
	}

	// Mutable object
	{
		let val: {a: 1} = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Mutable object (nested in mutable object)
	{
		let val: {a: {b: 1}} = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Interface
	{
		interface Foo {
			a: {b: number}
		}
		let val: Foo = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Interface (nested in interface)
	{
		interface Foo {
			a: {b: number}
		}
		interface Bar {
			foo: Foo
		}
		let val: Bar = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Readonly object
	{
		let val: {readonly a: 1} = _
		let draft: {a: 1} = _
		val = assert(toDraft(val), draft)
	}

	// Readonly object (nested in tuple)
	{
		let val: [{readonly a: 1}] = _
		let draft: [{a: 1}] = _
		val = assert(toDraft(val), draft)
	}

	// Loose function
	{
		let val: Function = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Strict function
	{
		let val: () => void = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Class type (mutable)
	{
		class Foo {
			private test: any
			constructor(public bar: string) {}
		}
		let val: Foo = _
		// TODO: Uncomment this when plain object types can be distinguished from class types.
		//       More info here: https://github.com/Microsoft/TypeScript/issues/29063
		// assert(toDraft(val), val)
		// assert(fromDraft(toDraft(val)), val)
	}

	// Class type (readonly)
	{
		class Foo {
			private test: any
			constructor(readonly bar: string) {}
		}
		let val: Foo = _
		// TODO: Uncomment this when plain object types can be distinguished from class types.
		//       More info here: https://github.com/Microsoft/TypeScript/issues/29063
		// assert(toDraft(val), val)
		// assert(fromDraft(toDraft(val)), val)
	}

	// Map instance
	{
		let val: Map<any, any> = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)

		// Weak maps
		let weak: WeakMap<any, any> = _
		assert(toDraft(weak), weak)
		assert(fromDraft(toDraft(weak)), weak)
	}

	// ReadonlyMap instance
	{
		let val: ReadonlyMap<any, any> = _
		let draft: Map<any, any> = _
		assert(toDraft(val), draft)
	}

	// Set instance
	{
		let val: Set<any> = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)

		// Weak sets
		let weak: WeakSet<any> = _
		assert(toDraft(weak), weak)
		assert(fromDraft(toDraft(weak)), weak)
	}

	// ReadonlySet instance
	{
		let val: ReadonlySet<any> = _
		let draft: Set<any> = _
		assert(toDraft(val), draft)
	}

	// Promise object
	{
		let val: Promise<any> = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Date instance
	{
		let val: Date = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// RegExp instance
	{
		let val: RegExp = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Boxed primitive
	{
		let val: Boolean = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// String literal
	{
		let val: string = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Any
	{
		let val: any = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Never
	{
		let val: never = _ as never
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Unknown
	{
		let val: unknown = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Numeral
	{
		let val: 1 = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Union of numerals
	{
		let val: 1 | 2 | 3 = _
		assert(toDraft(val), val)
		assert(fromDraft(toDraft(val)), val)
	}

	// Union of tuple, array, object
	{
		let val: [0] | ReadonlyArray<string> | Readonly<{a: 1}> = _
		let draft: [0] | string[] | {a: 1} = _
		val = assert(toDraft(val), draft)
	}

	// Generic type
	{
		// NOTE: "extends any" only helps a little.
		const $ = <T extends any>(val: ReadonlyArray<T>) => {
			let draft: Draft<typeof val> = _
			val = assert(toDraft(val), draft)
			// $ExpectError: [ts] Argument of type 'DraftArray<T>' is not assignable to parameter of type 'Draft<T>'. [2345]
			// assert(fromDraft(draft), draft)
		}
	}

	expect(true).toBe(true)
})

test("castDraft", () => {
	type Todo = {readonly done: boolean}

	type State = {
		readonly finishedTodos: ReadonlyArray<Todo>
		readonly unfinishedTodos: ReadonlyArray<Todo>
	}

	function markAllFinished(state: State) {
		produce(state, draft => {
			draft.finishedTodos = castDraft(state.unfinishedTodos)
		})
	}
})

test("#505 original", () => {
	const baseState = {users: [{name: "Richie"}] as const}
	const nextState = produce(baseState, draftState => {
		original(draftState.users) === baseState.users
	})
})

test("castDraft preserves a value", () => {
	const x = {}
	expect(castDraft(x)).toBe(x)
})

test("#512 createDraft creates a draft", () => {
	const x = {y: 1}
	assert(x, _ as Draft<{y: number}>)
})
