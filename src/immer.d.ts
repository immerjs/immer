/** Object types that should never be mapped */
type AtomicObject =
    | Function
    | Map<any, any>
    | WeakMap<any, any>
    | Set<any>
    | WeakSet<any>
    | Promise<any>
    | Date
    | RegExp
    | Boolean
    | Number
    | String

type ArrayMethod = Exclude<keyof [], number>
type Indices<T> = Exclude<keyof T, ArrayMethod>

export type DraftArray<T extends ReadonlyArray<any>> = Array<
    {[P in Indices<T>]: Draft<T[P]>}[Indices<T>]
>

export type DraftTuple<T extends ReadonlyArray<any>> = {
    [P in keyof T]: P extends Indices<T> ? Draft<T[P]> : never
}

export type Draft<T> = T extends never[]
    ? T
    : T extends ReadonlyArray<any>
    ? T[number][] extends T
        ? DraftArray<T>
        : DraftTuple<T>
    : T extends AtomicObject
    ? T
    : T extends object
    ? {-readonly [P in keyof T]: Draft<T[P]>}
    : T

export interface Patch {
    op: "replace" | "remove" | "add"
    path: (string | number)[]
    value?: any
}

export type PatchListener = (patches: Patch[], inversePatches: Patch[]) => void

/** Converts `nothing` into `undefined` */
type FromNothing<T> = T extends Nothing ? undefined : T

/** The inferred return type of `produce` */
export type Produced<Base, Return> = Return extends void
    ? Base
    : Return extends Promise<infer Result>
    ? Promise<Result extends void ? Base : FromNothing<Result>>
    : FromNothing<Return>

type ImmutableTuple<T extends ReadonlyArray<any>> = {
    readonly [P in keyof T]: Immutable<T[P]>
}

/** Convert a mutable type into a readonly type */
export type Immutable<T> = T extends object
    ? T extends AtomicObject
        ? T
        : T extends ReadonlyArray<any>
        ? Array<T[number]> extends T
            ? {[P in keyof T]: ReadonlyArray<Immutable<T[number]>>}[keyof T]
            : ImmutableTuple<T>
        : {readonly [P in keyof T]: Immutable<T[P]>}
    : T

export interface IProduce {
    /**
     * The `produce` function takes a value and a "recipe function" (whose
     * return value often depends on the base state). The recipe function is
     * free to mutate its first argument however it wants. All mutations are
     * only ever applied to a __copy__ of the base state.
     *
     * Pass only a function to create a "curried producer" which relieves you
     * from passing the recipe function every time.
     *
     * Only plain objects and arrays are made mutable. All other objects are
     * considered uncopyable.
     *
     * Note: This function is __bound__ to its `Immer` instance.
     *
     * @param {any} base - the initial state
     * @param {Function} producer - function that receives a proxy of the base state as first argument and which can be freely modified
     * @param {Function} patchListener - optional function that will be called with all the patches produced here
     * @returns {any} a new state, or the initial state if nothing was modified
     */
    <T = any, Return = void, D = Draft<T>>(
        base: T,
        recipe: (this: D, draft: D) => Return,
        listener?: PatchListener
    ): Produced<T, Return>

    /** Curried producer with a default value */
    <T = any, Rest extends any[] = [], Return = void, D = Draft<T>>(
        recipe: (this: D, draft: D, ...rest: Rest) => Return,
        defaultBase: T
    ): (base: Immutable<D> | undefined, ...rest: Rest) => Produced<D, Return>

    /** Curried producer with no default value */
    <T = any, Rest extends any[] = [], Return = void>(
        recipe: (this: Draft<T>, draft: Draft<T>, ...rest: Rest) => Return
    ): (base: Immutable<T>, ...rest: Rest) => Produced<T, Return>
}

export const produce: IProduce
export default produce

/** Use a class type for `nothing` so its type is unique */
declare class Nothing {
    // This lets us do `Exclude<T, Nothing>`
    private _: any
}

/**
 * The sentinel value returned by producers to replace the draft with undefined.
 */
export const nothing: Nothing

/**
 * To let Immer treat your class instances as plain immutable objects
 * (albeit with a custom prototype), you must define either an instance property
 * or a static property on each of your custom classes.
 *
 * Otherwise, your class instance will never be drafted, which means it won't be
 * safe to mutate in a produce callback.
 */
export const immerable: unique symbol

/**
 * Pass true to automatically freeze all copies created by Immer.
 *
 * By default, auto-freezing is disabled in production.
 */
export function setAutoFreeze(autoFreeze: boolean): void

/**
 * Pass true to use the ES2015 `Proxy` class when creating drafts, which is
 * always faster than using ES5 proxies.
 *
 * By default, feature detection is used, so calling this is rarely necessary.
 */
export function setUseProxies(useProxies: boolean): void

/**
 * Apply an array of Immer patches to the first argument.
 *
 * This function is a producer, which means copy-on-write is in effect.
 */
export function applyPatches<S>(base: S, patches: Patch[]): S

/**
 * Create an Immer draft from the given base state, which may be a draft itself.
 * The draft can be modified until you finalize it with the `finishDraft` function.
 */
export function createDraft<T>(base: T): Draft<T>

/**
 * Finalize an Immer draft from a `createDraft` call, returning the base state
 * (if no changes were made) or a modified copy. The draft must *not* be
 * mutated afterwards.
 *
 * Pass a function as the 2nd argument to generate Immer patches based on the
 * changes that were made.
 */
export function finishDraft<T>(draft: T, listener?: PatchListener): Immutable<T>

/** Get the underlying object that is represented by the given draft */
export function original<T>(value: T): T | void

/** Returns true if the given value is an Immer draft */
export function isDraft(value: any): boolean

/** Returns true if the given value can be drafted by Immer */
export function isDraftable(value: any): boolean

export class Immer {
    constructor(config: {
        useProxies?: boolean
        autoFreeze?: boolean
        onAssign?: (
            state: ImmerState,
            prop: string | number,
            value: unknown
        ) => void
        onDelete?: (state: ImmerState, prop: string | number) => void
        onCopy?: (state: ImmerState) => void
    })
    /**
     * The `produce` function takes a value and a "recipe function" (whose
     * return value often depends on the base state). The recipe function is
     * free to mutate its first argument however it wants. All mutations are
     * only ever applied to a __copy__ of the base state.
     *
     * Pass only a function to create a "curried producer" which relieves you
     * from passing the recipe function every time.
     *
     * Only plain objects and arrays are made mutable. All other objects are
     * considered uncopyable.
     *
     * Note: This function is __bound__ to its `Immer` instance.
     *
     * @param {any} base - the initial state
     * @param {Function} producer - function that receives a proxy of the base state as first argument and which can be freely modified
     * @param {Function} patchListener - optional function that will be called with all the patches produced here
     * @returns {any} a new state, or the initial state if nothing was modified
     */
    produce: IProduce
    /**
     * When true, `produce` will freeze the copies it creates.
     */
    readonly autoFreeze: boolean
    /**
     * When true, drafts are ES2015 proxies.
     */
    readonly useProxies: boolean
    /**
     * Pass true to automatically freeze all copies created by Immer.
     *
     * By default, auto-freezing is disabled in production.
     */
    setAutoFreeze(autoFreeze: boolean): void
    /**
     * Pass true to use the ES2015 `Proxy` class when creating drafts, which is
     * always faster than using ES5 proxies.
     *
     * By default, feature detection is used, so calling this is rarely necessary.
     */
    setUseProxies(useProxies: boolean): void
}

export interface ImmerState<T = any> {
    parent?: ImmerState
    base: T
    copy: T
    assigned: {[prop: string]: boolean; [index: number]: boolean}
}

// Backward compatibility with --target es5
declare global {
    interface Set<T> {}
    interface Map<K, V> {}
    interface WeakSet<T> {}
    interface WeakMap<K extends object, V> {}
}
