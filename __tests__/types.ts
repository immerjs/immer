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
declare const toDraft: <T>(value: T) => Draft<T>
declare const fromDraft: <T>(draft: Draft<T>) => T

/** Trigger a compiler error when a value is _not_ an exact type. */
declare const exactType: <T, U extends T>(
    draft?: U,
    expected?: T
) => T extends U ? T : 1 & 0

// Tuple
{
    let val: [1, 2]
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Tuple (nested in a tuple)
{
    let val: [[1, 2]]
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Tuple (nested in two readonly arrays)
{
    let val: ReadonlyArray<ReadonlyArray<[1, 2]>>
    let draft: [1, 2][][]
    draft = exactType(toDraft(val), draft)
    val = fromDraft(draft)
}

// Mutable array
{
    let val: string[]
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Mutable array (nested in tuple)
{
    let val: [string[]]
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Readonly array
{
    let val: ReadonlyArray<string>
    let draft: string[]
    draft = exactType(toDraft(val), draft)
    val = fromDraft(draft)
}

// Readonly array (nested in readonly object)
{
    let val: {readonly a: ReadonlyArray<string>}
    let draft: {a: string[]}
    draft = exactType(toDraft(val), draft)
    val = fromDraft(draft)
}

// Mutable object
{
    let val: {a: 1}
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Mutable object (nested in mutable object)
{
    let val: {a: {b: 1}}
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Interface
{
    interface Foo {
        a: {b: number}
    }
    let val: Foo
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Interface (nested in interface)
{
    interface Foo {
        a: {b: number}
    }
    interface Bar {
        foo: Foo
    }
    let val: Bar
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Readonly object
{
    let val: Readonly<{a: 1}>
    let draft: {a: 1}
    draft = exactType(toDraft(val), val)
    val = exactType(fromDraft(draft), val)
}

// Readonly object (nested in tuple)
{
    let val: [Readonly<{a: 1}>]
    let draft: DraftTuple<[{a: 1}]>
    draft = exactType(toDraft(val), val)
    val = exactType(fromDraft(draft), val)
}

// Loose function
{
    let val: Function
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Strict function
{
    let val: () => void
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Map instance
{
    let val: Map<any, any>
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)

    // Weak maps
    let weak: WeakMap<any, any>
    weak = exactType(toDraft(weak), weak)
    weak = exactType(fromDraft(toDraft(weak)), weak)
}

// Set instance
{
    let val: Set<any>
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)

    // Weak sets
    let weak: WeakSet<any>
    weak = exactType(toDraft(weak), weak)
    weak = exactType(fromDraft(toDraft(weak)), weak)
}

// Promise object
{
    let val: Promise<any>
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Date instance
{
    let val: Date
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// RegExp instance
{
    let val: RegExp
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Boxed primitive
{
    let val: Boolean
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// String literal
{
    let val: string
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Any
{
    let val: any
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Never
{
    let val: never
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Unknown
{
    // TODO: Uncomment this when Typescript is upgraded to 3.0+
    // let val: unknown
    // val = exactType(toDraft(val), val)
    // val = exactType(fromDraft(toDraft(val)), val)
}

// Numeral
{
    let val: 1
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Union of numerals
{
    let val: 1 | 2 | 3
    val = exactType(toDraft(val), val)
    val = exactType(fromDraft(toDraft(val)), val)
}

// Union of tuple, array, object
{
    let val: [0] | ReadonlyArray<string> | Readonly<{a: 1}>
    let draft: DraftTuple<[0]> | string[] | {a: 1}
    draft = exactType(toDraft(val), val)
    val = exactType(fromDraft(draft), val)
}
