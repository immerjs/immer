import {
	IProduceWithPatches,
	IProduce,
	ImmerState,
	Drafted,
	Patch,
	Objectish,
	Draft,
	PatchListener,
	isMap,
	isSet,
	createProxyProxy,
	getPlugin,
	getCurrentScope,
	DEFAULT_AUTOFREEZE,
	DEFAULT_USE_STRICT_SHALLOW_COPY,
	ImmerContext,
	applyPatchesImpl,
	createDraftImpl,
	finishDraftImpl,
	produceImpl,
	produceWithPatchesImpl,
	setAutoFreezeImpl,
	setUseStrictShallowCopyImpl
} from "../internal"

interface ProducersFns {
	produce: IProduce
	produceWithPatches: IProduceWithPatches
}

export type StrictMode = boolean | "class_only";

export class Immer implements ProducersFns, ImmerContext {
	autoFreeze_: boolean = DEFAULT_AUTOFREEZE
	useStrictShallowCopy_: StrictMode = DEFAULT_USE_STRICT_SHALLOW_COPY

	constructor(config?: {
		autoFreeze?: boolean
		useStrictShallowCopy?: StrictMode
	}) {
		if (typeof config?.autoFreeze === "boolean")
			this.setAutoFreeze(config!.autoFreeze)
		if (typeof config?.useStrictShallowCopy === "boolean")
			this.setUseStrictShallowCopy(config!.useStrictShallowCopy)
	}

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
	 * @param {Function} recipe - function that receives a proxy of the base state as first argument and which can be freely modified
	 * @param {Function} patchListener - optional function that will be called with all the patches produced here
	 * @returns {any} a new state, or the initial state if nothing was modified
	 */
	produce: IProduce = produceImpl.bind(this)

	produceWithPatches: IProduceWithPatches = produceWithPatchesImpl.bind(this)

	createDraft = createDraftImpl.bind(this) as <T extends Objectish>(
		base: T
	) => Draft<T>

	finishDraft = finishDraftImpl.bind(this) as <D extends Draft<any>>(
		draft: D,
		patchListener?: PatchListener
	) => D extends Draft<infer T> ? T : never

	/**
	 * Pass true to automatically freeze all copies created by Immer.
	 *
	 * By default, auto-freezing is enabled.
	 */
	setAutoFreeze = setAutoFreezeImpl.bind(this)

	/**
	 * Pass true to enable strict shallow copy.
	 *
	 * By default, immer does not copy the object descriptors such as getter, setter and non-enumrable properties.
	 */
	setUseStrictShallowCopy = setUseStrictShallowCopyImpl.bind(this)

	applyPatches = applyPatchesImpl.bind(this) as <T extends Objectish>(
		base: T,
		patches: readonly Patch[]
	) => T
}

export function createProxy<T extends Objectish>(
	value: T,
	parent?: ImmerState
): Drafted<T, ImmerState> {
	// precondition: createProxy should be guarded by isDraftable, so we know we can safely draft
	const draft: Drafted = isMap(value)
		? getPlugin("MapSet").proxyMap_(value, parent)
		: isSet(value)
		? getPlugin("MapSet").proxySet_(value, parent)
		: createProxyProxy(value, parent)

	const scope = parent ? parent.scope_ : getCurrentScope()
	scope.drafts_.push(draft)
	return draft
}
