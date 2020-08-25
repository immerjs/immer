import {Nothing} from "../internal"

type Tail<T extends any[]> = ((...t: T) => any) extends (
	_: any,
	...tail: infer TT
) => any
	? TT
	: []

/** Object types that should never be mapped */
type AtomicObject =
	| Function
	| Promise<any>
	| Date
	| RegExp
	| Boolean
	| Number
	| String

/**
 * These should also never be mapped but must be tested after regular Map and
 * Set
 */
type WeakReferences = WeakMap<any, any> | WeakSet<any>

export type WritableDraft<T> = {-readonly [K in keyof T]: Draft<T[K]>}

export type Draft<T> = T extends AtomicObject
	? T
	: T extends ReadonlyMap<infer K, infer V> // Map extends ReadonlyMap
	? Map<Draft<K>, Draft<V>>
	: T extends ReadonlySet<infer V> // Set extends ReadonlySet
	? Set<Draft<V>>
	: T extends WeakReferences
	? T
	: T extends object
	? WritableDraft<T>
	: T

/** Convert a mutable type into a readonly type */
export type Immutable<T> = T extends AtomicObject
	? T
	: T extends ReadonlyMap<infer K, infer V> // Map extends ReadonlyMap
	? ReadonlyMap<Immutable<K>, Immutable<V>>
	: T extends ReadonlySet<infer V> // Set extends ReadonlySet
	? ReadonlySet<Immutable<V>>
	: T extends WeakReferences
	? T
	: T extends object
	? {readonly [K in keyof T]: Immutable<T[K]>}
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
export interface IProduce {
	/** Curried producer */
	<
		Recipe extends (...args: any[]) => any,
		Params extends any[] = Parameters<Recipe>,
		T = Params[0]
	>(
		recipe: Recipe
	): <Base extends Immutable<T>>(
		base: Base,
		...rest: Tail<Params>
	) => Produced<Base, ReturnType<Recipe>>
	//   ^ by making the returned type generic, the actual type of the passed in object is preferred
	//     over the type used in the recipe. However, it does have to satisfy the immutable version used in the recipe
	//     Note: the type of S is the widened version of T, so it can have more props than T, but that is technically actually correct!

	/** Curried producer with initial state */
	<
		Recipe extends (...args: any[]) => any,
		Params extends any[] = Parameters<Recipe>,
		T = Params[0]
	>(
		recipe: Recipe,
		initialState: Immutable<T>
	): <Base extends Immutable<T>>(
		base?: Base,
		...rest: Tail<Params>
	) => Produced<Base, ReturnType<Recipe>>

	/** Normal producer */
	<Base, D = Draft<Base>, Return = void>(
		base: Base,
		recipe: (draft: D) => Return,
		listener?: PatchListener
	): Produced<Base, Return>
}

/**
 * Like `produce`, but instead of just returning the new state,
 * a tuple is returned with [nextState, patches, inversePatches]
 *
 * Like produce, this function supports currying
 */
export interface IProduceWithPatches {
	/** Curried producer */
	<
		Recipe extends (...args: any[]) => any,
		Params extends any[] = Parameters<Recipe>,
		T = Params[0]
	>(
		recipe: Recipe
	): <Base extends Immutable<T>>(
		base: Base,
		...rest: Tail<Params>
	) => [Produced<Base, ReturnType<Recipe>>, Patch[], Patch[]]
	//   ^ by making the returned type generic, the actual type of the passed in object is preferred
	//     over the type used in the recipe. However, it does have to satisfy the immutable version used in the recipe
	//     Note: the type of S is the widened version of T, so it can have more props than T, but that is technically actually correct!

	/** Curried producer with initial state */
	<
		Recipe extends (...args: any[]) => any,
		Params extends any[] = Parameters<Recipe>,
		T = Params[0]
	>(
		recipe: Recipe,
		initialState: Immutable<T>
	): <Base extends Immutable<T>>(
		base?: Base,
		...rest: Tail<Params>
	) => [Produced<Base, ReturnType<Recipe>>, Patch[], Patch[]]

	/** Normal producer */
	<Base, D = Draft<Base>, Return = void>(
		base: Base,
		recipe: (draft: D) => Return
	): [Produced<Base, Return>, Patch[], Patch[]]
}

// Fixes #507: bili doesn't export the types of this file if there is no actual source in it..
// hopefully it get's tree-shaken away for everyone :)
export function never_used() {}
