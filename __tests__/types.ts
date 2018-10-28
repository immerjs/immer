import produce, {
    produce as produce2,
    applyPatches,
    Draft,
    Patch,
    DraftTuple
} from "../src/immer"

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
    let patches: Patch[]
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

/**
 * Draft<T>
 */

// For checking if a type is assignable to its draft type (and vice versa)
const toDraft = <T>(value: T): Draft<T> => value as any
const fromDraft = <T>(draft: Draft<T>): T => draft as any

// Tuple
{
    let val: [1, 2]
    val = fromDraft(toDraft(val))
    let draft: DraftTuple<typeof val> = toDraft(val)
}

// Tuple (nested in a tuple)
{
    let val: [[1, 2]]
    val = fromDraft(toDraft(val))
    let draft: DraftTuple<typeof val> = toDraft(val)
}

// Tuple (nested in two readonly arrays)
{
    let val: ReadonlyArray<ReadonlyArray<[1, 2]>>
    val = fromDraft(toDraft(val))
    let draft: DraftTuple<[1, 2]>[][] = toDraft(val)
}

// Mutable array
{
    let val: string[]
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)
}

// Readonly array
{
    let val: ReadonlyArray<string>
    val = fromDraft(toDraft(val))
    let draft: string[] = toDraft(val)
}

// Readonly array (nested in readonly object)
{
    let val: {readonly a: ReadonlyArray<string>}
    val = fromDraft(toDraft(val))
    let draft: {a: string[]} = toDraft(val)
}

// Mutable object
{
    let val: {a: 1}
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)
}

// Readonly object
{
    let val: Readonly<{a: 1}>
    val = fromDraft(toDraft(val))
    let draft: {a: 1} = toDraft(val)
}

// Readonly object (nested in tuple)
{
    let val: [Readonly<{a: 1}>]
    val = fromDraft(toDraft(val))
    let draft: DraftTuple<[{a: 1}]> = toDraft(val)
}

// Loose function
{
    let val: Function
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)
}

// Strict function
{
    let val: () => void
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)
}

// Map instance
{
    let val: Map<any, any>
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)

    let weak: WeakMap<any, any>
    weak = fromDraft(toDraft(weak))
    let weakDraft: typeof weak = toDraft(weak)
}

// Set instance
{
    let val: Set<any>
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)

    let weak: WeakSet<any>
    weak = fromDraft(toDraft(weak))
    let weakDraft: typeof weak = toDraft(weak)
}

// Promise object
{
    let val: Promise<any>
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)
}

// Date instance
{
    let val: Date
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)
}

// RegExp instance
{
    let val: RegExp
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)
}

// Boxed primitive
{
    let val: Boolean
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)
}

// String literal
{
    let val: string
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)
}

// Any
{
    let val: any
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)
}

// Never
{
    let val: never
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)
}

// Numeral
{
    let val: 1
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)
}

// Union of numerals
{
    let val: 1 | 2 | 3
    val = fromDraft(toDraft(val))
    let draft: typeof val = toDraft(val)
}

// Union of tuple, array, object
{
    let val: [0] | ReadonlyArray<string> | Readonly<{a: 1}>
    val = fromDraft(toDraft(val))
    let draft: DraftTuple<[0]> | string[] | {a: 1} = toDraft(val)
}
