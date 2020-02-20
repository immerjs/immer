import {
	IProduceWithPatches,
	IProduce,
	ImmerState,
	Drafted,
	isDraftable,
	ImmerScope,
	processResult,
	NOTHING,
	Patch,
	Objectish,
	DRAFT_STATE,
	Draft,
	PatchListener,
	isDraft,
	isMap,
	isSet,
	markChangedProxy,
	createProxyProxy,
	freeze,
	getPlugin,
	die
} from "../internal"

/* istanbul ignore next */
function verifyMinified() {}

interface ProducersFns {
	produce: IProduce
	produceWithPatches: IProduceWithPatches
}

export class Immer implements ProducersFns {
	useProxies_: boolean =
		typeof Proxy !== "undefined" &&
		typeof Proxy.revocable !== "undefined" &&
		typeof Reflect !== "undefined"
	autoFreeze_: boolean = __DEV__
		? false /* istanbul ignore next */
		: verifyMinified.name === "verifyMinified"

	constructor(config?: {useProxies?: boolean; autoFreeze?: boolean}) {
		if (typeof config?.useProxies === "boolean")
			this.setUseProxies(config!.useProxies)
		if (typeof config?.autoFreeze === "boolean")
			this.setAutoFreeze(config!.autoFreeze)
		this.produce = this.produce.bind(this)
		this.produceWithPatches = this.produceWithPatches.bind(this)
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
	 * @param {Function} producer - function that receives a proxy of the base state as first argument and which can be freely modified
	 * @param {Function} patchListener - optional function that will be called with all the patches produced here
	 * @returns {any} a new state, or the initial state if nothing was modified
	 */
	produce(base: any, recipe?: any, patchListener?: any) {
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
				return self.produce(base, (draft: Drafted) => recipe.call(this, draft, ...args)) // prettier-ignore
			}
		}

		if (typeof recipe !== "function") die(6)
		if (patchListener !== undefined && typeof patchListener !== "function")
			die(7)

		let result

		// Only plain objects, arrays, and "immerable classes" are drafted.
		if (isDraftable(base)) {
			const scope = ImmerScope.enter_(this)
			const proxy = createProxy(this, base, undefined)
			let hasError = true
			try {
				result = recipe(proxy)
				hasError = false
			} finally {
				// finally instead of catch + rethrow better preserves original stack
				if (hasError) scope.revoke_()
				else scope.leave_()
			}
			if (typeof Promise !== "undefined" && result instanceof Promise) {
				return result.then(
					result => {
						scope.usePatches_(patchListener)
						return processResult(result, scope)
					},
					error => {
						scope.revoke_()
						throw error
					}
				)
			}
			scope.usePatches_(patchListener)
			return processResult(result, scope)
		} else {
			result = recipe(base)
			if (result === NOTHING) return undefined
			if (result === undefined) result = base
			if (this.autoFreeze_) freeze(result, true)
			return result
		}
	}

	produceWithPatches(arg1: any, arg2?: any, arg3?: any): any {
		if (typeof arg1 === "function") {
			return (state: any, ...args: any[]) =>
				this.produceWithPatches(state, (draft: any) => arg1(draft, ...args))
		}

		let patches: Patch[], inversePatches: Patch[]
		const nextState = this.produce(arg1, arg2, (p: Patch[], ip: Patch[]) => {
			patches = p
			inversePatches = ip
		})
		return [nextState, patches!, inversePatches!]
	}

	createDraft<T extends Objectish>(base: T): Draft<T> {
		if (!isDraftable(base)) die(8)
		const scope = ImmerScope.enter_(this)
		const proxy = createProxy(this, base, undefined)
		proxy[DRAFT_STATE].isManual_ = true
		scope.leave_()
		return proxy as any
	}

	finishDraft<D extends Draft<any>>(
		draft: D,
		patchListener?: PatchListener
	): D extends Draft<infer T> ? T : never {
		const state: ImmerState = draft && draft[DRAFT_STATE]
		if (__DEV__) {
			if (!state || !state.isManual_) die(9)
			if (state.finalized_) die(10)
		}
		const {scope_: scope} = state
		scope.usePatches_(patchListener)
		return processResult(undefined, scope)
	}

	/**
	 * Pass true to automatically freeze all copies created by Immer.
	 *
	 * By default, auto-freezing is disabled in production.
	 */
	setAutoFreeze(value: boolean) {
		this.autoFreeze_ = value
	}

	/**
	 * Pass true to use the ES2015 `Proxy` class when creating drafts, which is
	 * always faster than using ES5 proxies.
	 *
	 * By default, feature detection is used, so calling this is rarely necessary.
	 */
	setUseProxies(value: boolean) {
		this.useProxies_ = value
	}

	applyPatches(base: Objectish, patches: Patch[]) {
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

		const applyPatchesImpl = getPlugin("patches").applyPatches_
		if (isDraft(base)) {
			// N.B: never hits if some patch a replacement, patches are never drafts
			return applyPatchesImpl(base, patches)
		}
		// Otherwise, produce a copy of the base state.
		return this.produce(base, (draft: Drafted) =>
			applyPatchesImpl(draft, patches.slice(i + 1))
		)
	}
}

export function createProxy<T extends Objectish>(
	immer: Immer,
	value: T,
	parent?: ImmerState
): Drafted<T, ImmerState> {
	// precondition: createProxy should be guarded by isDraftable, so we know we can safely draft
	const draft: Drafted = isMap(value)
		? getPlugin("mapset").proxyMap_(value, parent)
		: isSet(value)
		? getPlugin("mapset").proxySet_(value, parent)
		: immer.useProxies_
		? createProxyProxy(value, parent)
		: getPlugin("es5").createES5Proxy_(value, parent)

	const scope = parent ? parent.scope_ : ImmerScope.current_!
	scope.drafts_.push(draft)
	return draft
}

export function markChanged(immer: Immer, state: ImmerState) {
	if (immer.useProxies_) {
		markChangedProxy(state)
	} else {
		getPlugin("es5").markChangedES5_(state)
	}
}
