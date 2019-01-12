import produce, {
    produce as produce2,
    applyPatches,
    Patch,
    nothing,
    Draft
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
    expect(newState).not.toBe(state)
    expect(newState).toEqual(expectedState)
})

// NOTE: only when the function type is inferred
it("can infer state type from default state", () => {
    type Producer = <T>(
        base: (Draft<T> extends number ? T : number) | undefined
    ) => number
    let foo = produce(_ => {}, 1)
    exactType(foo, {} as Producer)
    exactType(foo(2), 0 as number)
})

it("can infer state type from recipe function", () => {
    type Base = string | number
    type Producer = <T>(
        base: (Draft<T> extends Base ? T : Base) | undefined,
        _2: number
    ) => Base

    let foo = produce((_: string | number, _2: number) => {}, 1)
    exactType(foo, {} as Producer)
    exactType(foo("", 0), {} as string | number)
})

it("cannot infer state type when the function type and default state are missing", () => {
    exactType(produce(_ => {}), {} as <T>(base: T) => any)
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
    type Foo = <T>(
        base: Draft<T> extends {} ? T : object,
        _2: number,
        _3: number
    ) => object
    let foo = produce((_1: object, _2: number, _3: number) => {})
    exactType(foo, {} as Foo)
    foo({}, 1, 2)

    // With initial state:
    type Bar = <T>(
        base: (Draft<T> extends {} ? T : object) | undefined,
        _2: number,
        _3: number
    ) => object
    let bar = produce((_1: object, _2: number, _3: number) => {}, {})
    exactType(bar, {} as Bar)
    bar(undefined, 1, 2)
})

it("can pass readonly arrays to curried producers", () => {
    let foo = produce((_: any[]) => {})
    foo([] as ReadonlyArray<any>)

    // With initial state:
    let bar = produce((_: any[]) => {}, [])
    bar([] as ReadonlyArray<any>)
})

it("always returns an immutable type", () => {
    let result = produce([] as any[], () => {})
    exactType(result, {} as ReadonlyArray<any>)
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
