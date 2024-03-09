import {assert, _} from "./spec_ts"
import {
	produce,
	applyPatches,
	Patch,
	nothing,
	Draft,
	Immutable,
	Immer,
	enableMapSet,
	enablePatches
} from "../src/immer"

enableMapSet()
enablePatches()

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
	const newState = produce(state, draft => {
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
	assert(newState, _ as State)
})

// NOTE: only when the function type is inferred
it("can infer state type from default state", () => {
	type State = {readonly a: number}
	type Recipe = (state?: State | undefined) => State

	let foo = produce((_: any) => {}, _ as State)
	assert(foo, _ as Recipe)
})

it("can infer state type from recipe function", () => {
	type A = {readonly a: string}
	type B = {readonly b: string}
	type State = A | B
	type Recipe = (state: State) => State

	let foo = produce((draft: State) => {
		assert(draft, _ as State)
		if (Math.random() > 0.5) return {a: "test"}
		else return {b: "boe"}
	})
	const x = foo({a: ""})
	const y = foo({b: ""})
	assert(foo, _ as Recipe)
})

it("can infer state type from recipe function with arguments", () => {
	type State = {readonly a: string} | {readonly b: string}
	type Recipe = (state: State, x: number) => State

	let foo = produce<State, [number]>((draft, x) => {
		assert(draft, _ as Draft<State>)
		assert(x, _ as number)
	})
	assert(foo, _ as Recipe)
})

it("can infer state type from recipe function with arguments and initial state", () => {
	type State = {readonly a: string} | {readonly b: string}
	type Recipe = (state: State | undefined, x: number) => State

	let foo = produce((draft: Draft<State>, x: number) => {}, _ as State)
	assert(foo, _ as Recipe)
})

it("cannot infer state type when the function type and default state are missing", () => {
	type Recipe = <S extends any>(state: S) => S
	const foo = produce((_: any) => {})
	// @ts-expect-error
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
			type Recipe = (state: State, a: number, b: number) => State
			let foo = produce((s: State, a: number, b: number) => {})
			assert(foo, _ as Recipe)
			foo(_ as State, 1, 2)
		}

		// Using argument parameters:
		{
			type Recipe = (state: Immutable<State>, ...rest: number[]) => Draft<State>
			let woo = produce((state: Draft<State>, ...args: number[]) => {})
			assert(woo, _ as Recipe)
			woo(_ as State, 1, 2)
		}

		// With initial state:
		{
			type Recipe = (state?: State | undefined, ...rest: number[]) => State
			let bar = produce((state: Draft<State>, ...args: number[]) => {},
			_ as State)
			assert(bar, _ as Recipe)
			bar(_ as State, 1, 2)
			bar(_ as State)
			bar()
		}

		// When args is a tuple:
		{
			type Recipe = (
				state: State | undefined,
				first: string,
				...rest: number[]
			) => State
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
			assert(foo, _ as (state: readonly string[]) => string[])
			foo([] as ReadonlyArray<string>)
		}

		// With initial state:
		{
			let bar = produce(() => {}, [] as ReadonlyArray<string>)
			assert(
				bar,
				_ as (state?: readonly string[] | undefined) => readonly string[]
			)
			bar([] as ReadonlyArray<string>)
			bar(undefined)
			bar()
		}
	})
})

it("works with return type of: number", () => {
	let base = {a: 0} as {a: number}
	{
		if (Math.random() === 100) {
			// @ts-expect-error, this return accidentally a number, this is probably a dev error!
			let result = produce(base, draft => draft.a++)
		}
	}
	{
		let result = produce(base, draft => void draft.a++)
		assert(result, _ as {a: number})
	}
})

it("can return an object type that is identical to the base type", () => {
	let base = {a: 0} as {a: number}
	let result = produce(base, draft => {
		return draft.a < 0 ? {a: 0} : undefined
	})
	assert(result, _ as {a: number})
})

it("can NOT return an object type that is _not_ assignable to the base type", () => {
	let base = {a: 0} as {a: number}
	// @ts-expect-error
	let result = produce(base, draft => {
		return draft.a < 0 ? {a: true} : undefined
	})
})

it("does not enforce immutability at the type level", () => {
	let result = produce([] as any[], draft => {
		draft.push(1)
	})
	assert(result, _ as any[])
})

it("can produce an undefined value", () => {
	type State = {readonly a: number} | undefined
	const base = {a: 0} as State

	// Return only nothing.
	let result = produce(base, _ => nothing)
	assert(result, _ as State)

	// Return maybe nothing.
	let result2 = produce(base, draft => {
		if (draft?.a ?? 0 > 0) return nothing
	})
	assert(result2, _ as State)
})

it("can return the draft itself", () => {
	let base = _ as {readonly a: number}
	let result = produce(base, draft => draft)

	assert(result, _ as {readonly a: number})
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

	const newState = produce(state, draft => {
		draft.price += 5
		draft.todos.push({
			title: "hi",
			done: true
		})
	})
	assert(newState, _ as State)

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
	assert(newState5, _ as State)
	// we can force the return type of the reducer by casting the initial state
	const newState3 = produce(reducer, state as State)()
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

	const newState = produce(state, draft => {
		draft.price + 5
		draft.todos.push({
			title: "hi",
			done: true
		})
	})
	assert(newState, _ as State)
	assert(newState, _ as Immutable<State>) // cause that is the same!

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
	assert(newState5, _ as State)
	// we can force the return type of the reducer by casting initial argument
	const newState3 = produce(reducer, state as State)()
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

it("#749 types Immer", () => {
	const t = {
		x: 3
	}

	const immer = new Immer()
	const z = immer.produce(t, d => {
		d.x++
		// @ts-expect-error
		d.y = 0
	})
	expect(z.x).toBe(4)
	// @ts-expect-error
	expect(z.z).toBeUndefined()
})

it("infers draft, #720", () => {
	function nextNumberCalculator(fn: (base: number) => number) {
		// noop
	}

	const res2 = nextNumberCalculator(
		produce(draft => {
			// @ts-expect-error
			let x: string = draft
			return draft + 1
		})
	)

	const res = nextNumberCalculator(
		produce(draft => {
			// @ts-expect-error
			let x: string = draft
			// return draft + 1;
			return undefined
		})
	)
})

it("infers draft, #720 - 2", () => {
	function useState<S>(
		initialState: S | (() => S)
	): [S, Dispatch<SetStateAction<S>>] {
		return [initialState, function() {}] as any
	}
	type Dispatch<A> = (value: A) => void
	type SetStateAction<S> = S | ((prevState: S) => S)

	const [n, setN] = useState({x: 3})

	setN(
		produce(draft => {
			// @ts-expect-error
			draft.y = 4
			draft.x = 5
			return draft
		})
	)

	setN(
		produce(draft => {
			// @ts-expect-error
			draft.y = 4
			draft.x = 5
			// return draft + 1;
			return undefined
		})
	)

	setN(
		produce(draft => {
			return {y: 3} as const
		})
	)
})

it("infers draft, #720 - 3", () => {
	function useState<S>(
		initialState: S | (() => S)
	): [S, Dispatch<SetStateAction<S>>] {
		return [initialState, function() {}] as any
	}
	type Dispatch<A> = (value: A) => void
	type SetStateAction<S> = S | ((prevState: S) => S)

	const [n, setN] = useState({x: 3} as {readonly x: number})

	setN(
		produce(draft => {
			// @ts-expect-error
			draft.y = 4
			draft.x = 5
			return draft
		})
	)

	setN(
		produce(draft => {
			// @ts-expect-error
			draft.y = 4
			draft.x = 5
			// return draft + 1;
			return undefined
		})
	)

	setN(
		produce(draft => {
			return {y: 3} as const
		})
	)
})

it("infers curried", () => {
	type Todo = {title: string}
	{
		const fn = produce((draft: Todo) => {
			let x: string = draft.title
		})

		fn({title: "test"})
		// @ts-expect-error
		fn(3)
	}
	{
		const fn = produce((draft: Todo) => {
			let x: string = draft.title
			return draft
		})

		fn({title: "test"})
		// @ts-expect-error
		fn(3)
	}
})

{
	type State = {count: number}
	type ROState = Immutable<State>
	const base: any = {count: 0}
	{
		// basic
		const res = produce(base as State, draft => {
			draft.count++
		})
		assert(res, _ as State)
	}
	{
		// basic
		const res = produce<State>(base, draft => {
			draft.count++
		})
		assert(res, _ as State)
	}
	{
		// basic
		const res = produce(base as ROState, draft => {
			draft.count++
		})
		assert(res, _ as ROState)
	}
	{
		// curried
		const f = produce((state: State) => {
			state.count++
		})
		assert(f, _ as (state: Immutable<State>) => State)
	}
	{
		// curried
		const f = produce((state: Draft<ROState>) => {
			state.count++
		})
		assert(f, _ as (state: ROState) => State)
	}
	{
		// curried
		const f: (value: State) => State = produce(state => {
			state.count++
		})
	}
	{
		// curried
		const f: (value: ROState) => ROState = produce(state => {
			state.count++
		})
	}
	{
		// curried initial
		const f = produce(state => {
			state.count++
		}, _ as State)
		assert(f, _ as (state?: State) => State)
	}
	{
		// curried initial
		const f = produce(state => {
			state.count++
		}, _ as ROState)
		assert(f, _ as (state?: ROState) => ROState)
	}
	{
		// curried
		const f: (value: State) => State = produce(state => {
			state.count++
		}, base as ROState)
	}
	{
		// curried
		const f: (value: ROState) => ROState = produce(state => {
			state.count++
		}, base as ROState)
	}
	{
		// nothing allowed
		const res = produce(base as State | undefined, draft => {
			return nothing
		})
		assert(res, _ as State | undefined)
	}
	{
		// as any
		const res = produce(base as State, draft => {
			return nothing as any
		})
		assert(res, _ as State)
	}
	{
		// nothing not allowed
		// @ts-expect-error
		produce(base as State, draft => {
			return nothing
		})
	}
	{
		const f = produce((draft: State) => {})
		const n = f(base as State)
		assert(n, _ as State)
	}
	{
		const f = produce((draft: Draft<ROState>) => {
			draft.count++
		})
		const n = f(base as ROState)
		assert(n, _ as State)
	}
	{
		// explictly use generic
		const f = produce<ROState>(draft => {
			draft.count++
		})
		const n = f(base as ROState)
		assert(n, _ as ROState) // yay!
	}
}

it("allows for mixed property value types", () => {
	type TestReadonlyObject = {
		readonly testObjectOrNull: {readonly testProperty: number} | null
	}

	const input: TestReadonlyObject = {testObjectOrNull: null}

	produce(input, draft => {
		if (draft.testObjectOrNull) {
			draft.testObjectOrNull.testProperty = 5
		}
	})
})
