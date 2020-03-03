import {assert, _} from "spec.ts"
import produce, {
	produce as produce2,
	applyPatches,
	Patch,
	nothing,
	Draft,
	Immutable,
	enableAllPlugins
} from "../src/immer"

enableAllPlugins()

interface State {
	readonly num: number
	readonly foo?: string
	bar: string
	readonly baz: {
		readonly x: number
		readonly y: number
	}
	readonly arr: ReadonlyArray<{readonly value: string}>
	readonly arr2: {readonly value: string}[]
}

const state: State = {
	num: 0,
	bar: "foo",
	baz: {
		x: 1,
		y: 2
	},
	arr: [{value: "asdf"}],
	arr2: [{value: "asdf"}]
}

const expectedState: State = {
	num: 1,
	foo: "bar",
	bar: "foo",
	baz: {
		x: 2,
		y: 3
	},
	arr: [{value: "foo"}, {value: "asf"}],
	arr2: [{value: "foo"}, {value: "asf"}]
}

it("can update readonly state via standard api", () => {
	const newState = produce<State>(state, draft => {
		draft.num++
		draft.foo = "bar"
		draft.bar = "foo"
		draft.baz.x++
		draft.baz.y++
		draft.arr[0].value = "foo"
		draft.arr.push({value: "asf"})
		draft.arr2[0].value = "foo"
		draft.arr2.push({value: "asf"})
	})
	assert(newState, state)
})

// NOTE: only when the function type is inferred
it("can infer state type from default state", () => {
	type State = {readonly a: number}
	type Recipe = <S extends State>(state?: S | undefined) => S

	let foo = produce((_: any) => {}, _ as State)
	assert(foo, _ as Recipe)
})

it("can infer state type from recipe function", () => {
	type State = {readonly a: string} | {readonly b: string}
	type Recipe = <S extends State>(state: S) => S

	let foo = produce((_: Draft<State>) => {})
	assert(foo, _ as Recipe)
})

it("can infer state type from recipe function with arguments", () => {
	type State = {readonly a: string} | {readonly b: string}
	type Recipe = <S extends State>(state: S, x: number) => S

	let foo = produce((draft: Draft<State>, x: number) => {})
	assert(foo, _ as Recipe)
})

it("can infer state type from recipe function with arguments and initial state", () => {
	type State = {readonly a: string} | {readonly b: string}
	type Recipe = <S extends State>(state: S | undefined, x: number) => S

	let foo = produce((draft: Draft<State>, x: number) => {}, _ as State)
	assert(foo, _ as Recipe)
})

it("cannot infer state type when the function type and default state are missing", () => {
	type Recipe = <S extends any>(state: S) => S
	const foo = produce((_: any) => {})
	assert(foo, _ as Recipe)
})

it("can update readonly state via curried api", () => {
	const newState = produce((draft: Draft<State>) => {
		draft.num++
		draft.foo = "bar"
		draft.bar = "foo"
		draft.baz.x++
		draft.baz.y++
		draft.arr[0].value = "foo"
		draft.arr.push({value: "asf"})
		draft.arr2[0].value = "foo"
		draft.arr2.push({value: "asf"})
	})(state)
	expect(newState).not.toBe(state)
	expect(newState).toEqual(expectedState)
})

it("can update use the non-default export", () => {
	const newState = produce2((draft: Draft<State>) => {
		draft.num++
		draft.foo = "bar"
		draft.bar = "foo"
		draft.baz.x++
		draft.baz.y++
		draft.arr[0].value = "foo"
		draft.arr.push({value: "asf"})
		draft.arr2[0].value = "foo"
		draft.arr2.push({value: "asf"})
	})(state)
	expect(newState).not.toBe(state)
	expect(newState).toEqual(expectedState)
})

it("can apply patches", () => {
	let patches: Patch[] = []
	produce(
		{x: 3},
		d => {
			d.x++
		},
		p => {
			patches = p
		}
	)

	expect(applyPatches({}, patches)).toEqual({x: 4})
})

describe("curried producer", () => {
	it("supports rest parameters", () => {
		type State = {readonly a: 1}

		// No initial state:
		{
			type Recipe = <S extends State>(state: S, a: number, b: number) => S
			let foo = produce((s: State, a: number, b: number) => {})
			assert(foo, _ as Recipe)
			foo(_ as State, 1, 2)
		}

		// Using argument parameters:
		{
			type Recipe = <S extends State>(state: S, ...rest: number[]) => S
			let woo = produce((state: Draft<State>, ...args: number[]) => {})
			assert(woo, _ as Recipe)
			woo(_ as State, 1, 2)
		}

		// With initial state:
		{
			type Recipe = <S extends State>(
				state?: S | undefined,
				...rest: number[]
			) => S
			let bar = produce((state: Draft<State>, ...args: number[]) => {},
			_ as State)
			assert(bar, _ as Recipe)
			bar(_ as State, 1, 2)
			bar(_ as State)
			bar()
		}

		// When args is a tuple:
		{
			type Recipe = <S extends State>(
				state: S | undefined,
				first: string,
				...rest: number[]
			) => S
			let tup = produce(
				(state: Draft<State>, ...args: [string, ...number[]]) => {},
				_ as State
			)
			assert(tup, _ as Recipe)
			tup({a: 1}, "", 2)
			tup(undefined, "", 2)
		}
	})

	it("can be passed a readonly array", () => {
		// No initial state:
		{
			let foo = produce((state: string[]) => {})
			assert(foo, _ as <S extends readonly string[]>(state: S) => S)
			foo([] as ReadonlyArray<string>)
		}

		// With initial state:
		{
			let bar = produce(() => {}, [] as ReadonlyArray<string>)
			assert(
				bar,
				_ as <S extends readonly string[]>(state?: S | undefined) => S
			)
			bar([] as ReadonlyArray<string>)
			bar(undefined)
			bar()
		}
	})
})

it("works with return type of: number", () => {
	let base = _ as {a: number}
	let result = produce(base, () => 1)
	assert(result, _ as number)
})

it("works with return type of: number | undefined", () => {
	let base = {a: 0} as {a: number}
	let result = produce(base, draft => {
		return draft.a < 0 ? 0 : undefined
	})
	assert(result, _ as {a: number} | number)
})

it("can return an object type that is identical to the base type", () => {
	let base = {a: 0} as {a: number}
	let result = produce(base, draft => {
		return draft.a < 0 ? {a: 0} : undefined
	})
	// TODO: Can we resolve the weird union of identical object types?
	assert(result, _ as {a: number} | {a: number})
})

it("can return an object type that is _not_ assignable to the base type", () => {
	let base = {a: 0} as {a: number}
	let result = produce(base, draft => {
		return draft.a < 0 ? {a: true} : undefined
	})
	assert(result, _ as {a: number} | {a: boolean})
})

it("does not enforce immutability at the type level", () => {
	let result = produce([] as any[], draft => {
		draft.push(1)
	})
	assert(result, _ as any[])
})

it("can produce an undefined value", () => {
	let base = {a: 0} as {readonly a: number}

	// Return only nothing.
	let result = produce(base, _ => nothing)
	assert(result, undefined)

	// Return maybe nothing.
	let result2 = produce(base, draft => {
		if (draft.a > 0) return nothing
	})
	assert(result2, _ as typeof base | undefined)
})

it("can return the draft itself", () => {
	let base = _ as {readonly a: number}
	let result = produce(base, draft => draft)

	// Currently, the `readonly` modifier is lost.
	assert(result, _ as {a: number})
})

it("can return a promise", () => {
	type Base = {readonly a: number}
	let base = {a: 0} as Base

	// Return a promise only.
	let res1 = produce(base, draft => {
		return Promise.resolve(draft.a > 0 ? null : undefined)
	})
	assert(res1, _ as Promise<Base | null>)

	// Return a promise or undefined.
	let res2 = produce(base, draft => {
		if (draft.a > 0) return Promise.resolve()
	})
	assert(res2, _ as Base | Promise<Base>)
})

it("works with `void` hack", () => {
	let base = {a: 0} as {readonly a: number}
	let copy = produce(base, s => void s.a++)
	assert(copy, base)
})

it("works with generic parameters", () => {
	let insert = <T>(array: readonly T[], index: number, elem: T) => {
		// Need explicit cast on draft as T[] is wider than readonly T[]
		return produce(array, (draft: T[]) => {
			draft.push(elem)
			draft.splice(index, 0, elem)
			draft.concat([elem])
		})
	}
	let val: {readonly a: ReadonlyArray<number>} = {a: []} as any
	let arr: ReadonlyArray<typeof val> = [] as any
	insert(arr, 0, val)
})

it("can work with non-readonly base types", () => {
	const state = {
		price: 10,
		todos: [
			{
				title: "test",
				done: false
			}
		]
	}
	type State = typeof state

	const newState: State = produce(state, draft => {
		draft.price += 5
		draft.todos.push({
			title: "hi",
			done: true
		})
	})

	const reducer = (draft: State) => {
		draft.price += 5
		draft.todos.push({
			title: "hi",
			done: true
		})
	}

	// base case for with-initial-state
	const newState4 = produce(reducer, state)(state)
	assert(newState4, _ as State)
	// no argument case, in that case, immutable version recipe first arg will be inferred
	const newState5 = produce(reducer, state)()
	assert(newState5, _ as Immutable<State>)
	// we can force the return type of the reducer by passing the generic argument
	const newState3 = produce(reducer, state)<State>()
	assert(newState3, _ as State)
})

it("can work with readonly base types", () => {
	type State = {
		readonly price: number
		readonly todos: readonly {
			readonly title: string
			readonly done: boolean
		}[]
	}

	const state: State = {
		price: 10,
		todos: [
			{
				title: "test",
				done: false
			}
		]
	}

	const newState: State = produce(state, draft => {
		draft.price + 5
		draft.todos.push({
			title: "hi",
			done: true
		})
	})

	const reducer = (draft: Draft<State>) => {
		draft.price += 5
		draft.todos.push({
			title: "hi",
			done: true
		})
	}
	const newState2: State = produce(reducer)(state)
	assert(newState2, _ as State)

	// base case for with-initial-state
	const newState4 = produce(reducer, state)(state)
	assert(newState4, _ as State)
	// no argument case, in that case, immutable version recipe first arg will be inferred
	const newState5 = produce(reducer, state)()
	assert(newState5, _ as Immutable<State>)
	// we can force the return type of the reducer by passing the generic argument
	const newState3 = produce(reducer, state)<State>()
	assert(newState3, _ as State)
})

it("works with generic array", () => {
	const append = <T>(queue: T[], item: T) =>
		// T[] is needed here v. Too bad.
		produce(queue, (queueDraft: T[]) => {
			queueDraft.push(item)
		})

	const queueBefore = [1, 2, 3]

	const queueAfter = append(queueBefore, 4)

	expect(queueAfter).toEqual([1, 2, 3, 4])
	expect(queueBefore).toEqual([1, 2, 3])
})

it("works with Map and Set", () => {
	const m = new Map([["a", {x: 1}]])
	const s = new Set([{x: 2}])

	const res1 = produce(m, draft => {
		assert(draft, _ as Map<string, {x: number}>)
	})
	assert(res1, _ as Map<string, {x: number}>)

	const res2 = produce(s, draft => {
		assert(draft, _ as Set<{x: number}>)
	})
	assert(res2, _ as Set<{x: number}>)
})

it("works with readonly Map and Set", () => {
	type S = {readonly x: number}
	const m = new Map<string, S>([["a", {x: 1}]])
	const s = new Set<S>([{x: 2}])

	const res1 = produce(m, (draft: Draft<Map<string, S>>) => {
		assert(draft, _ as Map<string, {x: number}>)
	})
	assert(res1, _ as Map<string, {readonly x: number}>)

	const res2 = produce(s, (draft: Draft<Set<S>>) => {
		assert(draft, _ as Set<{x: number}>)
	})
	assert(res2, _ as Set<{readonly x: number}>)
})

it("works with ReadonlyMap and ReadonlySet", () => {
	type S = {readonly x: number}
	const m: ReadonlyMap<string, S> = new Map([["a", {x: 1}]])
	const s: ReadonlySet<S> = new Set([{x: 2}])

	const res1 = produce(m, (draft: Draft<Map<string, S>>) => {
		assert(draft, _ as Map<string, {x: number}>)
	})
	assert(res1, _ as ReadonlyMap<string, {readonly x: number}>)

	const res2 = produce(s, (draft: Draft<Set<S>>) => {
		assert(draft, _ as Set<{x: number}>)
	})
	assert(res2, _ as ReadonlySet<{readonly x: number}>)
})

it("shows error in production if called incorrectly", () => {
	expect(() => {
		debugger
		produce(null as any)
	}).toThrow(
		(global as any).USES_BUILD
			? "[Immer] minified error nr: 6"
			: "[Immer] The first or second argument to `produce` must be a function"
	)
})
