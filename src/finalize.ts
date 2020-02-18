import {
	Immer,
	ImmerScope,
	DRAFT_STATE,
	isDraftable,
	NOTHING,
	Drafted,
	PatchPath,
	ProxyType,
	each,
	has,
	freeze,
	generatePatches,
	shallowCopy,
	ImmerState,
	isSet,
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

function finalize(scope: ImmerScope, draft: Drafted, path?: PatchPath) {
	const state: ImmerState = draft[DRAFT_STATE]
	if (!state) {
		if (Object.isFrozen(draft)) return draft
		return finalizeTree(scope, draft)
	}
	// Never finalize drafts owned by another scope.
	if (state.scope_ !== scope) {
		return draft
	}
	if (!state.modified_) {
		maybeFreeze(scope, state.base_, true)
		return state.base_
	}
	if (!state.finalized_) {
		state.finalized_ = true
		finalizeTree(scope, draft, path)

		// At this point, all descendants of `state.copy` have been finalized,
		// so we can be sure that `scope.canAutoFreeze` is accurate.
		if (scope.immer_.autoFreeze_ && scope.canAutoFreeze_) {
			freeze(state.copy_, false)
		}

		if (path && scope.patches_) {
			generatePatches(state, path, scope.patches_, scope.inversePatches_!)
		}
	}
	return state.copy_
}

function finalizeTree(rootScope: ImmerScope, value: any, rootPath?: PatchPath) {
	// TODO: enable
	// if (Object.isFrozen(value))
	// 	return value;
	const state: ImmerState = value[DRAFT_STATE]
	if (state) {
		// if (rootScope !== state.scope_)
		// 		// Drafts from another scope must prevent auto-freezing.
		// 		state.scope_.canAutoFreeze_ = false;
		if (
			state.type_ === ProxyType.ES5Object ||
			state.type_ === ProxyType.ES5Array
		) {
			// Create the final copy, with added keys and without deleted keys.
			state.copy_ = shallowCopy(state.draft_, true)
		}
		value = state.copy_
	}
	each(value, (key, childValue) =>
		finalizeProperty(rootScope, state, value, key, childValue, rootPath)
	)
	return value
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

	// In the `finalizeTree` method, only the `root` object may be a draft.
	const isDraftProp = !!parentState
	const isSetMember = isSet(targetObject) // TODO: move inside if

	// if the child is a draft, we can build a more precise patch
	if (isDraft(childValue)) {
		const path =
			rootPath &&
			isDraftProp &&
			!isSetMember && // Set objects are atomic since they have no keys.
			!has((parentState as Exclude<ImmerState, SetState>).assigned_!, prop) // Skip deep patches for assigned keys.
				? rootPath!.concat(prop)
				: undefined

		// Drafts owned by `scope` are finalized here.
		const res = finalize(rootScope, childValue, path)
		set(targetObject, prop, res)

		// Drafts from another scope must prevent auto-freezing.
		// TODO: weird place for this condition
		// if we got a draft back, we're in a nested thing and shouldn't freese
		if (isDraft(res)) {
			rootScope.canAutoFreeze_ = false
		}

		return
	}
	// Unchanged draft properties are ignored.
	if (isDraftProp && is(childValue, get(parentState!.base_, prop))) {
		return
	}
	// TODO: cleanup conditions for reuse?
	// Search new objects for unfinalized drafts. Frozen objects should never contain drafts.
	if (isDraftable(childValue)) {
		finalizeTree(rootScope, childValue)
		// TODO: needed?
		// set(targetObject, prop, res)
		// TODO: drop first condition?
		// TODO: needed?
		if (!parentState || !parentState.scope_.parent_)
			maybeFreeze(rootScope, childValue)
	}
}

export function maybeFreeze(scope: {immer_: Immer}, value: any, deep = false) {
	if (scope.immer_.autoFreeze_ && !isDraft(value)) {
		freeze(value, deep)
	}
}
