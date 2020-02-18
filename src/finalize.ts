import {
	ImmerScope,
	DRAFT_STATE,
	isDraftable,
	NOTHING,
	PatchPath,
	ProxyType,
	each,
	has,
	freeze,
	generatePatches,
	shallowCopy,
	ImmerState,
	isDraft,
	SetState,
	set,
	is,
	get,
	willFinalize
} from "./internal"
import invariant from "tiny-invariant"

export function processResult(result: any, scope: ImmerScope) {
	const baseDraft = scope.drafts_![0]
	const isReplaced = result !== undefined && result !== baseDraft
	willFinalize(scope, result, isReplaced)
	if (isReplaced) {
		if (baseDraft[DRAFT_STATE].modified_) {
			scope.revoke_()
			invariant(false, "An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.") // prettier-ignore
		}
		if (isDraftable(result)) {
			// Finalize the result in case it contains (or is) a subset of the draft.
			result = finalize(scope, result)
			if (!scope.parent_) maybeFreeze(scope, result)
		}
		if (scope.patches_) {
			scope.patches_.push({
				op: "replace",
				path: [],
				value: result
			})
			scope.inversePatches_!.push({
				op: "replace",
				path: [],
				value: (baseDraft[DRAFT_STATE] as ImmerState).base_
			})
		}
	} else {
		// Finalize the base draft.
		result = finalize(scope, baseDraft, [])
	}
	scope.revoke_()
	if (scope.patches_) {
		scope.patchListener_!(scope.patches_, scope.inversePatches_!)
	}
	return result !== NOTHING ? result : undefined
}

function finalize(rootScope: ImmerScope, value: any, path?: PatchPath) {
	// Don't recurse in tho recursive data structures
	if (Object.isFrozen(value)) return value

	const state: ImmerState = value[DRAFT_STATE]
	// A plain object, might need freezing, might contain drafts
	if (!state) {
		each(value, (key, childValue) =>
			finalizeProperty(rootScope, state, value, key, childValue, path)
		)
		return value
	}
	// Never finalize drafts owned by another scope.
	if (state.scope_ !== rootScope) return value
	// Unmodified draft, return the (frozen) original
	if (!state.modified_) {
		maybeFreeze(rootScope, state.base_, true)
		return state.base_
	}
	// Not finalized yet, let's do that now
	if (!state.finalized_) {
		state.finalized_ = true
		const result =
			// For ES5, create a good copy from the draft first, with added keys and without deleted keys.
			state.type_ === ProxyType.ES5Object || state.type_ === ProxyType.ES5Array
				? (state.copy_ = shallowCopy(state.draft_, true))
				: state.copy_
		// finalize all children of the copy
		each(result as any, (key, childValue) =>
			finalizeProperty(rootScope, state, result, key, childValue, path)
		)
		// everything inside is frozen, we can freeze here
		maybeFreeze(rootScope, result, false)
		// first time finalizing, let's create those patches
		if (path && rootScope.patches_) {
			generatePatches(
				state,
				path,
				rootScope.patches_,
				rootScope.inversePatches_!
			)
		}
	}
	return state.copy_
}

function finalizeProperty(
	rootScope: ImmerScope,
	parentState: undefined | ImmerState,
	targetObject: any,
	prop: string | number,
	childValue: any,
	rootPath?: PatchPath
) {
	invariant(childValue !== targetObject, "Immer forbids circular references")
	if (isDraft(childValue)) {
		const path =
			rootPath &&
			parentState &&
			parentState!.type_ !== ProxyType.Set && // Set objects are atomic since they have no keys.
			!has((parentState as Exclude<ImmerState, SetState>).assigned_!, prop) // Skip deep patches for assigned keys.
				? rootPath!.concat(prop)
				: undefined
		// Drafts owned by `scope` are finalized here.
		const res = finalize(rootScope, childValue, path)
		set(targetObject, prop, res)
		// Drafts from another scope must prevented to be frozen
		// if we got a draft back from finalize, we're in a nested produce and shouldn't freeze
		if (isDraft(res)) {
			rootScope.canAutoFreeze_ = false
		} else return
	}
	// Unchanged draft properties are ignored.
	if (parentState && is(childValue, get(parentState!.base_, prop))) {
		return
	}
	// Search new objects for unfinalized drafts. Frozen objects should never contain drafts.
	if (isDraftable(childValue)) {
		finalize(rootScope, childValue)
		// immer deep freezes plain objects, so if there is no parent state, we freeze as well
		if (!parentState || !parentState.scope_.parent_)
			maybeFreeze(rootScope, childValue)
	}
}

export function maybeFreeze(scope: ImmerScope, value: any, deep = false) {
	if (scope.immer_.autoFreeze_ && scope.canAutoFreeze_) {
		freeze(value, deep)
	}
}
