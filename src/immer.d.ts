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

/** Includes 1 when `void` or `undefined` exists in type `T` */
type HasVoidLike<T> = (void extends T ? 1 : 0) | (undefined extends T ? 1 : 0)

/** Includes 1 when type `T` is `void` or `undefined` (or both) */
type IsVoidLike<T> =
    | (T extends void ? 1 : 0)
    | (T extends undefined ? 1 : 0)
    | (T extends void | undefined ? 1 : 0)

/** Converts `nothing` into `undefined` */
type FromNothing<T> = Nothing extends T ? Exclude<T, Nothing> | undefined : T

/** The inferred return type of `produce` */
type Produced<Base, Return> = 1 extends HasVoidLike<Return>
    ? 1 extends IsVoidLike<Return>
        ? Base
        : Base | FromNothing<Exclude<Return, void>>
    : FromNothing<Return>

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
    <Base, Proxy = Draft<Base>, Return = void>(
        base: Base,
        recipe: (this: Proxy, draft: Proxy) => Return,
        listener?: PatchListener
    ): Produced<Base, Return>

    /** Curried producer */
    <Default = any, Base = Default, Rest extends any[] = [], Return = void>(
        recipe: (
            this: Draft<Base>,
            draft: Draft<Base>,
            ...rest: Rest
        ) => Return,
        defaultBase?: Default
    ): (base: Base | undefined, ...rest: Rest) => Produced<Base, Return>
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

export function original<T>(value: T): T | void

export function isDraft(value: any): boolean

export class Immer {
    constructor(config: {
        useProxies?: boolean
        autoFreeze?: boolean
        onAssign?: (state: ImmerState, prop: keyof any, value: any) => void
        onDelete?: (state: ImmerState, prop: keyof any) => void
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
    assigned: {[prop: string]: boolean}
}
