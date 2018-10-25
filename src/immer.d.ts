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
    : T extends ReadonlyArray<infer U> ? (U[] extends T ? false : true) : true

export type DraftObject<T> = T extends object
    ? T extends AtomicObject ? T : {-readonly [P in keyof T]: Draft<T[P]>}
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
    ? IsFinite<T> extends true ? DraftTuple<T> : DraftArray<T[number]>
    : T extends ReadonlyArray<any>
        ? DraftArray<T[number]>
        : T extends object ? DraftObject<T> : T

export interface Patch {
    op: "replace" | "remove" | "add"
    path: (string | number)[]
    value?: any
}

export type PatchListener = (patches: Patch[], inversePatches: Patch[]) => void

export interface IProduce {
    /**
     * Immer takes a state, and runs a function against it.
     * That function can freely mutate the state, as it will create copies-on-write.
     * This means that the original state will stay unchanged, and once the function finishes, the modified state is returned.
     *
     * If the first argument is a function, this is interpreted as the recipe, and will create a curried function that will execute the recipe
     * any time it is called with the current state.
     *
     * @param currentState - the state to start with
     * @param recipe - function that receives a proxy of the current state as first argument and which can be freely modified
     * @param initialState - if a curried function is created and this argument was given, it will be used as fallback if the curried function is called with a state of undefined
     * @returns The next state: a new state, or the current state if nothing was modified
     */
    <S = any>(
        currentState: S,
        recipe: (this: Draft<S>, draftState: Draft<S>) => void | S,
        listener?: PatchListener
    ): S

    // curried invocations with default initial state
    // 0 additional arguments
    <S = any>(
        recipe: (this: Draft<S>, draftState: Draft<S>) => void | S,
        initialState: S
    ): (currentState: S | undefined) => S
    // 1 additional argument of type A
    <S = any, A = any>(
        recipe: (this: Draft<S>, draftState: Draft<S>, a: A) => void | S,
        initialState: S
    ): (currentState: S | undefined, a: A) => S
    // 2 additional arguments of types A and B
    <S = any, A = any, B = any>(
        recipe: (this: Draft<S>, draftState: Draft<S>, a: A, b: B) => void | S,
        initialState: S
    ): (currentState: S | undefined, a: A, b: B) => S
    // 3 additional arguments of types A, B and C
    <S = any, A = any, B = any, C = any>(
        recipe: (
            this: Draft<S>,
            draftState: Draft<S>,
            a: A,
            b: B,
            c: C
        ) => void | S,
        initialState: S
    ): (currentState: S | undefined, a: A, b: B, c: C) => S
    // any number of additional arguments, but with loss of type safety
    // this may be alleviated if "variadic kinds" makes it into Typescript:
    // https://github.com/Microsoft/TypeScript/issues/5453
    <S = any>(
        recipe: (
            this: Draft<S>,
            draftState: Draft<S>,
            ...extraArgs: any[]
        ) => void | S,
        initialState: S
    ): (currentState: S | undefined, ...extraArgs: any[]) => S

    // curried invocations without default initial state
    // 0 additional arguments
    <S = any>(recipe: (this: Draft<S>, draftState: Draft<S>) => void | S): (
        currentState: S
    ) => S
    // 1 additional argument of type A
    <S = any, A = any>(
        recipe: (this: Draft<S>, draftState: Draft<S>, a: A) => void | S
    ): (currentState: S, a: A) => S
    // 2 additional arguments of types A and B
    <S = any, A = any, B = any>(
        recipe: (this: Draft<S>, draftState: Draft<S>, a: A, b: B) => void | S
    ): (currentState: S, a: A, b: B) => S
    // 3 additional arguments of types A, B and C
    <S = any, A = any, B = any, C = any>(
        recipe: (
            this: Draft<S>,
            draftState: Draft<S>,
            a: A,
            b: B,
            c: C
        ) => void | S
    ): (currentState: S, a: A, b: B, c: C) => S
    // any number of additional arguments, but with loss of type safety
    // this may be alleviated if "variadic kinds" makes it into Typescript:
    // https://github.com/Microsoft/TypeScript/issues/5453
    <S = any>(
        recipe: (
            this: Draft<S>,
            draftState: Draft<S>,
            ...extraArgs: any[]
        ) => void | S
    ): (currentState: S, ...extraArgs: any[]) => S
}

export const produce: IProduce
export default produce

export const nothing: undefined

/**
 * Automatically freezes any state trees generated by immer.
 * This protects against accidental modifications of the state tree outside of an immer function.
 * This comes with a performance impact, so it is recommended to disable this option in production.
 * It is by default enabled.
 */
export function setAutoFreeze(autoFreeze: boolean): void

/**
 * Manually override whether proxies should be used.
 * By default done by using feature detection
 */
export function setUseProxies(useProxies: boolean): void

export function applyPatches<S>(state: S, patches: Patch[]): S

export function original<T>(value: T): T | void

export function isDraft(value: any): boolean
