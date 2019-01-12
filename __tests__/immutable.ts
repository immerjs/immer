import {Immutable} from "../dist/immer.js"

// prettier-ignore
type Exact<A, B> = (<T>() => T extends A ? 1 : 0) extends (<T>() => T extends B ? 1 : 0)
    ? (A extends B ? (B extends A ? unknown : never) : never)
    : never

/** Fails when `actual` and `expected` have different types. */
declare const exactType: <Actual, Expected>(
    actual: Actual & Exact<Actual, Expected>,
    expected: Expected & Exact<Actual, Expected>
) => Expected

// array in tuple
{
    let val = {} as Immutable<[string[], 1]>
    exactType(val, {} as [ReadonlyArray<string>, 1])
}

// tuple in array
{
    let val = {} as Immutable<[string, 1][]>
    exactType(val, {} as ReadonlyArray<[string, 1]>)
}

// tuple in tuple
{
    let val = {} as Immutable<[[string, 1], 1]>
    exactType(val, {} as [[string, 1], 1])
}

// array in array
{
    let val = {} as Immutable<string[][]>
    exactType(val, {} as ReadonlyArray<ReadonlyArray<string>>)
}

// tuple in object
{
    let val = {} as Immutable<{a: [string, 1]}>
    exactType(val, {} as {readonly a: [string, 1]})
}

// object in tuple
{
    let val = {} as Immutable<[{a: string}, 1]>
    exactType(val, {} as [{readonly a: string}, 1])
}

// array in object
{
    let val = {} as Immutable<{a: string[]}>
    exactType(val, {} as {readonly a: ReadonlyArray<string>})
}

// object in array
{
    let val = {} as Immutable<Array<{a: string}>>
    exactType(val, {} as ReadonlyArray<{readonly a: string}>)
}

// object in object
{
    let val = {} as Immutable<{a: {b: string}}>
    exactType(val, {} as {readonly a: {readonly b: string}})
}
