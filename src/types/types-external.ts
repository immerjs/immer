import {Nothing} from "../internal"
import {DRAFT_STATE} from "../utils/env"

type Tail<T extends any[]> = ((...t: T) => any) extends (
	_: any,
	...tail: infer TT
) => any
	? TT
	: []

type PrimitiveType = number | string | boolean

/** Object types that should never be mapped */
type AtomicObject = Function | Promise<any> | Date | RegExp

/**
 * If the lib "ES2105.collections" is not included in tsconfig.json,
 * types like ReadonlyArray, WeakMap etc. fall back to `any` (specified nowhere)
 * or `{}` (from the node types), in both cases entering an infite recursion in
 * pattern matching type mappings
 * This type can be used to cast these types to `void` in these cases.
 */
export type IfAvailable<T, Fallback = void> =
	// fallback if any
	true | false extends (T extends never
	? true
	: false)
		? Fallback // fallback if empty type
		: keyof T extends never
		? Fallback // original type
		: T

/**
 * These should also never be mapped but must be tested after regular Map and
 * Set
 */
type WeakReferences = IfAvailable<WeakMap<any, any>> | IfAvailable<WeakSet<any>>

export type WritableDraft<T> = {-readonly [K in keyof T]: Draft<T[K]>}

export type Draft<T> = T extends PrimitiveType
	? T
	: T extends AtomicObject
	? T
	: T extends IfAvailable<ReadonlyMap<infer K, infer V>> // Map extends ReadonlyMap
	? Map<Draft<K>, Draft<V>>
	: T extends IfAvailable<ReadonlySet<infer V>> // Set extends ReadonlySet
	? Set<Draft<V>>
	: T extends WeakReferences
	? T
	: T extends object
	? WritableDraft<T>
	: T

/** Convert a mutable type into a readonly type */
export type Immutable<T> = T extends PrimitiveType
	? T
	: T extends AtomicObject
	? T
	: T extends IfAvailable<ReadonlyMap<infer K, infer V>> // Map extends ReadonlyMap
	? ReadonlyMap<Immutable<K>, Immutable<V>>
	: T extends IfAvailable<ReadonlySet<infer V>> // Set extends ReadonlySet
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

type InferRecipe<FN> = FN extends (
	base: infer STATE,
	...rest: infer ARGS
) => any
	? (draft: Draft<STATE>, ...rest: ARGS) => ReturnType<FN> | undefined // TODO: or STATE | undefined?
	: never

type ValidRecipeReturnType<State> =
	| State
	| void
	| undefined
	| Promise<State | void | undefined>

type InferProducerReturnFromRecipe<State, Recipe> = Recipe extends (
	...args: any[]
) => Promise<any>
	? Promise<Immutable<State>>
	: Immutable<State>

type InferCurriedFromRecipe<Recipe> = Recipe extends (
	draft: infer DraftState,
	...args: infer RestArgs
) => any // verify return type
	? Recipe extends (...args: any[]) => ValidRecipeReturnType<DraftState>
		? (
				base: Immutable<DraftState>,
				...args: RestArgs
		  ) => InferProducerReturnFromRecipe<DraftState, Recipe>
		: never // incorrect return type
	: never // not a function

type InferCurriedFromStateAndRecipe<State, Recipe> = Recipe extends (
	draft: Draft<State>,
	...rest: infer RestArgs
) => Draft<State> | void | undefined | Nothing
	? (base?: Immutable<State> | undefined, ...args: RestArgs) => Immutable<State>
	: never // recipe doesn't match initial state

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
	/** Curried producer that infers the recipe from the curried output function (e.g. when passing to setState) */
	<Curried>(recipe: InferRecipe<Curried>): Curried

	/** Curried producer that infers curried from the recipe  */
	<Recipe>(recipe: Recipe): InferCurriedFromRecipe<Recipe>

	/** Curried producer with initial state, infers recipe from initial state */
	<State, Recipe extends Function>(
		recipe: Recipe,
		initialState: State
	): InferCurriedFromStateAndRecipe<State, Recipe>

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
