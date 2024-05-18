import {
	applyPatchesImpl,
	createDraftImpl,
	createImmerContext,
	Draft,
	finishDraftImpl,
	Immer,
	Immutable,
	IProduce,
	IProduceWithPatches,
	Objectish,
	Patch,
	PatchListener,
	produceImpl,
	produceWithPatchesImpl,
	setAutoFreezeImpl,
	setUseStrictShallowCopyImpl
} from "./internal"

export {
	Draft,
	WritableDraft,
	Immutable,
	Patch,
	PatchListener,
	Producer,
	original,
	current,
	isDraft,
	isDraftable,
	NOTHING as nothing,
	DRAFTABLE as immerable,
	freeze,
	Objectish,
	StrictMode
} from "./internal"

const globalImmerContext = createImmerContext()

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
export const produce: IProduce = produceImpl.bind(globalImmerContext)

/**
 * Like `produce`, but `produceWithPatches` always returns a tuple
 * [nextState, patches, inversePatches] (instead of just the next state)
 */
export const produceWithPatches: IProduceWithPatches = produceWithPatchesImpl.bind(
	globalImmerContext
)

/**
 * Pass true to automatically freeze all copies created by Immer.
 *
 * Always freeze by default, even in production mode
 */
export const setAutoFreeze = setAutoFreezeImpl.bind(globalImmerContext)

/**
 * Pass true to enable strict shallow copy.
 *
 * By default, immer does not copy the object descriptors such as getter, setter and non-enumrable properties.
 */
export const setUseStrictShallowCopy = setUseStrictShallowCopyImpl.bind(
	globalImmerContext
)

/**
 * Apply an array of Immer patches to the first argument.
 *
 * This function is a producer, which means copy-on-write is in effect.
 */
export const applyPatches = applyPatchesImpl.bind(globalImmerContext) as <
	T extends Objectish
>(
	base: T,
	patches: readonly Patch[]
) => T

/**
 * Create an Immer draft from the given base state, which may be a draft itself.
 * The draft can be modified until you finalize it with the `finishDraft` function.
 */
export const createDraft = createDraftImpl.bind(globalImmerContext) as <
	T extends Objectish
>(
	base: T
) => Draft<T>

/**
 * Finalize an Immer draft from a `createDraft` call, returning the base state
 * (if no changes were made) or a modified copy. The draft must *not* be
 * mutated afterwards.
 *
 * Pass a function as the 2nd argument to generate Immer patches based on the
 * changes that were made.
 */
export const finishDraft = finishDraftImpl.bind(globalImmerContext) as <
	D extends Draft<any>
>(
	draft: D,
	patchListener?: PatchListener
) => D extends Draft<infer T> ? T : never

/**
 * This function is actually a no-op, but can be used to cast an immutable type
 * to an draft type and make TypeScript happy
 *
 * @param value
 */
export function castDraft<T>(value: T): Draft<T> {
	return value as any
}

/**
 * This function is actually a no-op, but can be used to cast a mutable type
 * to an immutable type and make TypeScript happy
 * @param value
 */
export function castImmutable<T>(value: T): Immutable<T> {
	return value as any
}

export {Immer}

export {enablePatches} from "./plugins/patches"
export {enableMapSet} from "./plugins/mapset"
