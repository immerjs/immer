import {
	DRAFT_STATE,
	Draft,
	Drafted,
	ImmerContext,
	ImmerState,
	NOTHING,
	Objectish,
	Patch,
	PatchListener,
	StrictMode,
	createProxy,
	current,
	die,
	enterScope,
	freeze,
	getPlugin,
	isDraft,
	isDraftable,
	leaveScope,
	processResult,
	revokeScope,
	usePatchesInScope
} from "../internal"

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
export function produceImpl(
	this: ImmerContext,
	base: any,
	recipe?: any,
	patchListener?: any
) {
	// curried invocation
	if (typeof base === "function" && typeof recipe !== "function") {
		const defaultBase = recipe
		recipe = base

		const self = this
		return function curriedProduce(
			this: any,
			base = defaultBase,
			...args: any[]
		) {
			return produceImpl.call(self, base, (draft: Drafted) => recipe.call(this, draft, ...args)) // prettier-ignore
		}
	}

	if (typeof recipe !== "function") die(6)
	if (patchListener !== undefined && typeof patchListener !== "function") die(7)

	let result

	// Only plain objects, arrays, and "immerable classes" are drafted.
	if (isDraftable(base)) {
		const scope = enterScope(this)
		const proxy = createProxy(base, undefined)
		let hasError = true
		try {
			result = recipe(proxy)
			hasError = false
		} finally {
			// finally instead of catch + rethrow better preserves original stack
			if (hasError) revokeScope(scope)
			else leaveScope(scope)
		}
		usePatchesInScope(scope, patchListener)
		return processResult(result, scope)
	} else if (!base || typeof base !== "object") {
		result = recipe(base)
		if (result === undefined) result = base
		if (result === NOTHING) result = undefined
		if (this.autoFreeze_) freeze(result, true)
		if (patchListener) {
			const p: Patch[] = []
			const ip: Patch[] = []
			getPlugin("Patches").generateReplacementPatches_(base, result, p, ip)
			patchListener(p, ip)
		}
		return result
	} else die(1, base)
}

/**
 * Like `produce`, but `produceWithPatches` always returns a tuple
 * [nextState, patches, inversePatches] (instead of just the next state)
 */
export function produceWithPatchesImpl(
	this: ImmerContext,
	base: any,
	recipe?: any
): any {
	// curried invocation
	if (typeof base === "function") {
		return (state: any, ...args: any[]) =>
			produceWithPatchesImpl.call(this, state, (draft: any) =>
				base(draft, ...args)
			)
	}

	let patches: Patch[], inversePatches: Patch[]
	const result = produceImpl.call(
		this,
		base,
		recipe,
		(p: Patch[], ip: Patch[]) => {
			patches = p
			inversePatches = ip
		}
	)
	return [result, patches!, inversePatches!]
}

/**
 * Create an Immer draft from the given base state, which may be a draft itself.
 * The draft can be modified until you finalize it with the `finishDraft` function.
 */
export function createDraftImpl<T extends Objectish>(
	this: ImmerContext,
	base: T
): Draft<T> {
	if (!isDraftable(base)) die(8)
	if (isDraft(base)) base = current(base)
	const scope = enterScope(this)
	const proxy = createProxy(base, undefined)
	proxy[DRAFT_STATE].isManual_ = true
	leaveScope(scope)
	return proxy as any
}

/**
 * Finalize an Immer draft from a `createDraft` call, returning the base state
 * (if no changes were made) or a modified copy. The draft must *not* be
 * mutated afterwards.
 *
 * Pass a function as the 2nd argument to generate Immer patches based on the
 * changes that were made.
 */
export function finishDraftImpl<D extends Draft<any>>(
	this: ImmerContext,
	draft: D,
	patchListener?: PatchListener
): D extends Draft<infer T> ? T : never {
	const state: ImmerState = draft && (draft as any)[DRAFT_STATE]
	if (!state || !state.isManual_) die(9)
	const {scope_: scope} = state
	usePatchesInScope(scope, patchListener)
	return processResult(undefined, scope)
}

/**
 * Pass true to automatically freeze all copies created by Immer.
 *
 * By default, auto-freezing is enabled.
 */
export function setAutoFreezeImpl(this: ImmerContext, value: boolean) {
	this.autoFreeze_ = value
}

/**
 * Pass true to enable strict shallow copy.
 *
 * By default, immer does not copy the object descriptors such as getter, setter and non-enumrable properties.
 */
export function setUseStrictShallowCopyImpl(
	this: ImmerContext,
	value: StrictMode
) {
	this.useStrictShallowCopy_ = value
}

/**
 * Apply an array of Immer patches to the first argument.
 *
 * This function is a producer, which means copy-on-write is in effect.
 */
export function applyPatchesImpl<T extends Objectish>(
	this: ImmerContext,
	base: T,
	patches: readonly Patch[]
): T {
	// If a patch replaces the entire state, take that replacement as base
	// before applying patches
	let i: number
	for (i = patches.length - 1; i >= 0; i--) {
		const patch = patches[i]
		if (patch.path.length === 0 && patch.op === "replace") {
			base = patch.value
			break
		}
	}
	// If there was a patch that replaced the entire state, start from the
	// patch after that.
	if (i > -1) {
		patches = patches.slice(i + 1)
	}

	const applyPatchesPluginImpl = getPlugin("Patches").applyPatches_
	if (isDraft(base)) {
		// N.B: never hits if some patch a replacement, patches are never drafts
		return applyPatchesPluginImpl(base, patches)
	}
	// Otherwise, produce a copy of the base state.
	return produceImpl.call(this, base, (draft: Drafted) =>
		applyPatchesPluginImpl(draft, patches)
	)
}
