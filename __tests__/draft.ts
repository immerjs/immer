import {Draft} from "../dist/immer.js"

// For checking if a type is assignable to its draft type (and vice versa)
declare const toDraft: <T>(value: T) => Draft<T>
declare const fromDraft: <T>(draft: Draft<T>) => T

// prettier-ignore
type Exact<A, B> = (<T>() => T extends A ? 1 : 0) extends (<T>() => T extends B ? 1 : 0)
    ? (A extends B ? (B extends A ? unknown : never) : never)
    : never

/** Fails when `actual` and `expected` have different types. */
declare const exactType: <Actual, Expected>(
    actual: Actual & Exact<Actual, Expected>,
    expected: Expected & Exact<Actual, Expected>
) => Expected

// To remove TS2454 errors.
declare const _: any

// DraftArray<T>
{
    // NOTE: As of 3.2.2, everything fails without "extends any"
    const $ = <Value extends any>(val: ReadonlyArray<Value>) => {
        val = _ as Draft<typeof val>
        let elem: Value = _ as Draft<Value>
    }
}

// Tuple
{
    let val: [1, 2] = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Tuple (nested in a tuple)
{
    let val: [[1, 2]] = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Tuple (nested in two mutable arrays)
{
    let val: [1, 2][][] = _
    let draft: typeof val = _
    val = exactType(toDraft(val), draft)
    exactType(fromDraft(draft), val)
}

// Tuple (nested in two readonly arrays)
{
    let val: ReadonlyArray<ReadonlyArray<[1, 2]>> = _
    let draft: [1, 2][][] = _
    val = exactType(toDraft(val), draft)
}

// Readonly tuple
{
    // TODO: Uncomment this when readonly tuples are supported.
    //       More info: https://stackoverflow.com/a/53822074/2228559
    // let val: Readonly<[1, 2]> = _
    // let draft: [1, 2] = _
    // draft = exactType(toDraft(val), draft)
    // val = fromDraft(draft)
}

// Mutable array
{
    let val: string[] = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Mutable array (nested in tuple)
{
    let val: [string[]] = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Readonly array
{
    let val: ReadonlyArray<string> = _
    let draft: string[] = _
    val = exactType(toDraft(val), draft)
    fromDraft(draft)
}

// Readonly array (nested in readonly object)
{
    let val: {readonly a: ReadonlyArray<string>} = _
    let draft: {a: string[]} = _
    val = exactType(toDraft(val), draft)
    fromDraft(draft)
}

// Mutable object
{
    let val: {a: 1} = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Mutable object (nested in mutable object)
{
    let val: {a: {b: 1}} = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Interface
{
    interface Foo {
        a: {b: number}
    }
    let val: Foo = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
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
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Readonly object
{
    let val: {readonly a: 1} = _
    let draft: {a: 1} = _
    val = exactType(toDraft(val), draft)
}

// Readonly object (nested in tuple)
{
    let val: [{readonly a: 1}] = _
    let draft: [{a: 1}] = _
    val = exactType(toDraft(val), draft)
}

// Loose function
{
    let val: Function = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Strict function
{
    let val: () => void = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
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
    // exactType(toDraft(val), val)
    // exactType(fromDraft(toDraft(val)), val)
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
    // exactType(toDraft(val), val)
    // exactType(fromDraft(toDraft(val)), val)
}

// Map instance
{
    let val: Map<any, any> = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)

    // Weak maps
    let weak: WeakMap<any, any> = _
    exactType(toDraft(weak), weak)
    exactType(fromDraft(toDraft(weak)), weak)
}

// Set instance
{
    let val: Set<any> = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)

    // Weak sets
    let weak: WeakSet<any> = _
    exactType(toDraft(weak), weak)
    exactType(fromDraft(toDraft(weak)), weak)
}

// Promise object
{
    let val: Promise<any> = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Date instance
{
    let val: Date = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// RegExp instance
{
    let val: RegExp = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Boxed primitive
{
    let val: Boolean = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// String literal
{
    let val: string = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Any
{
    let val: any = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Never
{
    let val: never = _ as never
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Unknown
{
    let val: unknown = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Numeral
{
    let val: 1 = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Union of numerals
{
    let val: 1 | 2 | 3 = _
    exactType(toDraft(val), val)
    exactType(fromDraft(toDraft(val)), val)
}

// Union of tuple, array, object
{
    let val: [0] | ReadonlyArray<string> | Readonly<{a: 1}> = _
    let draft: [0] | string[] | {a: 1} = _
    val = exactType(toDraft(val), draft)
}

// Generic type
{
    // NOTE: "extends any" only helps a little.
    const $ = <T extends any>(val: ReadonlyArray<T>) => {
        let draft: Draft<typeof val> = _
        val = exactType(toDraft(val), draft)
        // $ExpectError: [ts] Argument of type 'DraftArray<T>' is not assignable to parameter of type 'Draft<T>'. [2345]
        // exactType(fromDraft(draft), draft)
    }
}
