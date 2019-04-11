import produce, {
    produce as produce2,
    applyPatches,
    Patch,
    nothing,
    Draft,
    Immutable
} from "../dist/immer.js"

// prettier-ignore
type Exact<A, B> = (<T>() => T extends A ? 1 : 0) extends (<T>() => T extends B ? 1 : 0)
    ? (A extends B ? (B extends A ? unknown : never) : never)
    : never

/** Fails when `actual` and `expected` have different types. */
declare const exactType: <Actual, Expected>(
    actual: Actual & Exact<Actual, Expected>,
    expected: Expected & Exact<Actual, Expected>
) => Expected

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
    exactType(newState, state)
})

// NOTE: only when the function type is inferred
it("can infer state type from default state", () => {
    type State = {readonly a:number} | boolean
    type Recipe = (base?: State | boolean) => State

    let foo = produce((x: any) => {}, {} as State)
    exactType(foo, {} as Recipe)
})

it("can infer state type from recipe function", () => {
    type State = {readonly a: string} | {readonly b: string}
    type Recipe = (base: State, n: number) => State

    let foo = produce((draft: Draft<State>, number: number) => {})
    exactType(foo, {} as Recipe)
    const state: State = foo({} as State, 3)
})

it("can infer state type from recipe function with arguments", () => {
    type State = {readonly a: string} | {readonly b: string}
    type Recipe = (base: State, x: number) => State

    let foo = produce((draft: Draft<State>, x: number) => {})
    exactType(foo, {} as Recipe)
})

it("can infer state type from recipe function with arguments and initial state", () => {
    type State = {readonly a: string} | {readonly b: string}
    type Recipe = (base: State | undefined, x: number) => State

    let foo = produce((draft: Draft<State>, x: number) => {}, {} as State)
    exactType(foo, {} as Recipe)
})

it("cannot infer state type when the function type and default state are missing", () => {
    const res = produce((_: any) => {})
    exactType(res, {} as (base: any) => any)

    // slightly different type inference...
    const res2 = produce((_) => {})
    exactType(res2, {} as (base: any, ...rest: any[]) => any)
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
        let foo = produce((s: State, a: number, b: number) => {})
        exactType(foo, {} as (base: State, x: number, y: number) => State)
        foo({} as State, 1, 2)

        // TODO: Using argument parameters
        // let woo = produce((state: Draft<State>, ...args: number[]) => {})
        // exactType(woo, {} as (base: State, ...args: number[]) => State)
        // woo({} as State, 1, 2)

        // With initial state:
        let bar = produce((state: Draft<State>, ...args: number[]) => {}, {} as State)
        exactType(bar, {} as (base?: undefined | Immutable<State>, ...args: number[]) => State)
        bar({} as State, 1, 2)
        bar({} as State)
        bar()

        // When args is a tuple:
        let tup = produce((state: Draft<State>, ...args: [string, ...number[]]) => {}, {} as State)
        exactType(tup, {} as (base: State | undefined, arg1: string, ...args: number[]) => State)
        tup({a: 1}, '', 2)
        tup(undefined, '', 2)
    })

    it("can be passed a readonly array", () => {
        // No initial state:
        let foo = produce((state: string[]) => {})
        exactType(foo, {} as (base: readonly string[]) => readonly string[])
        foo([] as ReadonlyArray<string>)

        // With initial state:
        let bar = produce(() => {}, [] as ReadonlyArray<any>)
        exactType(bar, {} as (base?: readonly any[]) => readonly any[])
        bar([] as ReadonlyArray<any>)
        bar(undefined)
        bar()
    })
})

it("works with return type of: number", () => {
    let base = {} as {a: number}
    let result = produce(base, () => 1)
    exactType(result, {} as number)
})

it("works with return type of: number | undefined", () => {
    let base = {} as {a: number}
    let result = produce(base, draft => {
        return draft.a < 0 ? 0 : undefined
    })
    exactType(result, {} as {a: number} | number)
})

it("can return an object type that is identical to the base type", () => {
    let base = {} as {a: number}
    let result = produce(base, draft => {
        return draft.a < 0 ? {a: 0} : undefined
    })
    // TODO: Can we resolve the weird union of identical object types?
    exactType(result, {} as {a: number} | {a: number})
})

it("can return an object type that is _not_ assignable to the base type", () => {
    let base = {} as {a: number}
    let result = produce(base, draft => {
        return draft.a < 0 ? {a: true} : undefined
    })
    exactType(result, {} as {a: number} | {a: boolean})
})

it("does not enforce immutability at the type level", () => {
    let result = produce([] as any[], draft => {
        draft.push(1)
    })
    exactType(result, {} as any[])
})

it("can produce an undefined value", () => {
    let base = {} as {readonly a: number}

    // Return only nothing.
    let result = produce(base, _ => nothing)
    exactType(result, undefined)

    // Return maybe nothing.
    let result2 = produce(base, draft => {
        if (draft.a > 0) return nothing
    })
    exactType(result2, {} as typeof base | undefined)
})

it("can return the draft itself", () => {
    let base = {} as {readonly a: number}
    let result = produce(base, draft => draft)

    // Currently, the `readonly` modifier is lost.
    exactType(result, {} as {a: number} | undefined)
})

it("can return a promise", () => {
    type Base = {readonly a: number}
    let base = {} as Base

    // Return a promise only.
    let res1 = produce(base, draft => {
        return Promise.resolve(draft.a > 0 ? null : undefined)
    })
    exactType(res1, {} as Promise<Base | null>)

    // Return a promise or undefined.
    let res2 = produce(base, draft => {
        if (draft.a > 0) return Promise.resolve()
    })
    exactType(res2, {} as Base | Promise<Base>)
})

it("works with `void` hack", () => {
    let base = {} as {readonly a: number}
    let copy = produce(base, s => void s.a++)
    exactType(copy, base)
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
    let val: {readonly a: ReadonlyArray<number>} = 0 as any
    let arr: ReadonlyArray<typeof val> = 0 as any
    insert(arr, 0, val)
})

it("can work with non-readonly base types", () => {
    const state = {
        price: 10,
        todos: [{
            title: "test",
            done: false
        }]
    }
    type State = typeof state

    const newState: State = produce(state, (draft) => {
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
    const newState2: Immutable<State> = produce(reducer)(state)
    const newState3: Immutable<State> = produce(reducer, state)()
})

it("can work with readonly base types", () => {
    type State = {
        readonly price: number;
        readonly todos: readonly {
            readonly title: string;
            readonly done: boolean;
        }[];
    }

    const state: State = {
        price: 10,
        todos: [{
            title: "test",
            done: false
        }]
    }

    const newState: State = produce(state, (draft) => {
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
    const newState3: State = produce(reducer, state)()
})