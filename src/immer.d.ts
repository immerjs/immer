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

/** Use type inference to know when an array is finite */
type IsFinite<T extends any[]> = T extends never[]
    ? true
    : T extends ReadonlyArray<infer U>
    ? (U[] extends T ? false : true)
    : true

export type DraftObject<T> = T extends object
    ? T extends AtomicObject
        ? T
        : {-readonly [P in keyof T]: Draft<T[P]>}
    : T

export type DraftArray<T> = Array<
    T extends ReadonlyArray<any>
        ? {[P in keyof T]: Draft<T>}[keyof T]
        : DraftObject<T>
>

export type DraftTuple<T extends any[]> = {
    [P in keyof T]: T[P] extends T[number] ? Draft<T[P]> : never
}

export type Draft<T> = T extends any[]
    ? IsFinite<T> extends true
        ? DraftTuple<T>
        : DraftArray<T[number]>
    : T extends ReadonlyArray<any>
    ? DraftArray<T[number]>
    : T extends object
    ? DraftObject<T>
    : T

export interface Patch {
    op: "replace" | "remove" | "add"
    path: (string | number)[]
    value?: any
}

export type PatchListener = (patches: Patch[], inversePatches: Patch[]) => void

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
    <State, Result = any>(
        currentState: State,
        recipe: (this: Draft<State>, draft: Draft<State>) => Result,
        listener?: PatchListener
    ): void extends Result ? State : Result

    /** Curried producer with an initial state */
    <State, Result = any, Args extends any[] = any[]>(
        recipe: (
            this: Draft<State>,
            draft: Draft<State>,
            ...extraArgs: Args
        ) => void | Result,
        defaultBase: State
    ): (base: State | undefined, ...extraArgs: Args) => void extends Result ? State : Result

    /** Curried producer with no initial state */
    <State, Result = any, Args extends any[] = any[]>(
        recipe: (
            this: Draft<State>,
            draft: Draft<State>,
            ...extraArgs: Args
        ) => void | Result
    ): (base: State, ...extraArgs: Args) => void extends Result ? State : Result
}

export const produce: IProduce
export default produce

/**
 * The sentinel value returned by producers to replace the draft with undefined.
 */
export const nothing: undefined

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
