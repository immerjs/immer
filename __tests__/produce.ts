import produce, {
    produce as produce2,
    applyPatches,
    Patch,
    DraftArray,
    Draft,
    nothing
} from "../dist/immer.js"

// prettier-ignore
type AssertEqual<T, U> = (<G>() => G extends T ? 1 : 0) extends (<G>() => G extends U ? 1 : 0) ? unknown : never

/** Trigger a compiler error when a value is _not_ an exact type. */
declare const exactType: <T, U>(
    draft: T & AssertEqual<T, U>,
    expected: U & AssertEqual<T, U>
) => U

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
    expect(newState).not.toBe(state)
    expect(newState).toEqual(expectedState)
})

// NOTE: only when the function type is inferred
it("can infer state type from default state", () => {
    type Producer = (base: number | undefined) => number

    let foo: Producer = {} as any
    exactType(produce(_ => {}, 1), foo)
    exactType(foo(2), {} as number)
})

it("can infer state type from recipe function", () => {
    type Producer = (
        base: string | number | undefined,
        _2: number
    ) => string | number

    let foo: Producer = {} as any
    let recipe = (_: string | number, _2: number) => {}
    exactType(produce(recipe, 1), foo)
    exactType(foo("", 0), {} as string | number)
})

it("cannot infer state type when the function type and default state are missing", () => {
    exactType(produce(_ => {}), {} as (base: any) => any)
})

it("can update readonly state via curried api", () => {
    const newState = produce<State>(draft => {
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
    const newState = produce2<State>(draft => {
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

it("can provide rest parameters to a curried producer", () => {
    let foo = produce((_1: {}, _2: number, _3: number) => {})
    foo({}, 1, 2)

    // With initial state:
    let bar = produce((_1: {}, _2: number, _3: number) => {}, {})
    bar(undefined, 1, 2)
})

it("can produce nothing", () => {
    let val: undefined = produce({}, s => nothing)
})

it("works with `void` hack", () => {
    let obj: {readonly a: number} = {a: 1}
    let val: typeof obj = produce(obj, s => void s.a++)
})

it("works with generic parameters", () => {
    let insert = <T>(array: ReadonlyArray<T>, index: number, elem: T) => {
        // NOTE: As of 3.2.2, the explicit argument type is required.
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
