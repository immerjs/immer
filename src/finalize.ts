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

export function processResult(immer: Immer, result: any, scope: ImmerScope) {
	const baseDraft = scope.drafts_![0]
	const isReplaced = result !== undefined && result !== baseDraft
	willFinalize(immer, scope, result, isReplaced)
	if (isReplaced) {
		if (baseDraft[DRAFT_STATE].modified_) {
			scope.revoke_()
			invariant(false, "An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.") // prettier-ignore
		}
		if (isDraftable(result)) {
			// Finalize the result in case it contains (or is) a subset of the draft.
			result = finalize(immer, result, scope)
			if (!scope.parent_) maybeFreeze(immer, result)
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
		result = finalize(immer, baseDraft, scope, [])
	}
	scope.revoke_()
	if (scope.patches_) {
		scope.patchListener_!(scope.patches_, scope.inversePatches_!)
	}
	return result !== NOTHING ? result : undefined
}

function finalize(
	immer: Immer,
	draft: Drafted,
	scope: ImmerScope,
	path?: PatchPath
) {
	const state: ImmerState = draft[DRAFT_STATE]
	if (!state) {
		if (Object.isFrozen(draft)) return draft
		return finalizeTree(immer, draft, scope)
	}
	// Never finalize drafts owned by another scope.
	if (state.scope_ !== scope) {
		return draft
	}
	if (!state.modified_) {
		maybeFreeze(immer, state.base_, true)
		return state.base_
	}
	if (!state.finalized_) {
		state.finalized_ = true
		finalizeTree(immer, state.draft_, scope, path)

		// We cannot really delete anything inside of a Set. We can only replace the whole Set.
		if (immer.onDelete && state.type_ !== ProxyType.Set) {
			// The `assigned` object is unreliable with ES5 drafts.
			if (immer.useProxies) {
				const {assigned_} = state
				each(assigned_ as any, (prop, exists) => {
					if (!exists) immer.onDelete!(state, prop as any)
				})
			} else {
				const {base_, copy_} = state
				each(base_, prop => {
					if (!has(copy_, prop)) immer.onDelete!(state, prop as any)
				})
			}
		}
		if (immer.onCopy) {
			immer.onCopy(state)
		}

		// At this point, all descendants of `state.copy` have been finalized,
		// so we can be sure that `scope.canAutoFreeze` is accurate.
		if (immer.autoFreeze && scope.canAutoFreeze_) {
			freeze(state.copy_, false)
		}

		if (path && scope.patches_) {
			generatePatches(state, path, scope.patches_, scope.inversePatches_!)
		}
	}
	return state.copy_
}

function finalizeTree(
	immer: Immer,
	root: Drafted,
	scope: ImmerScope,
	rootPath?: PatchPath
) {
	const state: ImmerState = root[DRAFT_STATE]
	if (state) {
		if (
			state.type_ === ProxyType.ES5Object ||
			state.type_ === ProxyType.ES5Array
		) {
			// Create the final copy, with added keys and without deleted keys.
			state.copy_ = shallowCopy(state.draft_, true)
		}
		root = state.copy_
	}
	each(root, (key, value) =>
		finalizeProperty(immer, scope, root, state, root, key, value, rootPath)
	)
	return root
}

function finalizeProperty(
	immer: Immer,
	scope: ImmerScope,
	root: Drafted,
	rootState: ImmerState,
	parentValue: Drafted,
	prop: string | number,
	childValue: any,
	rootPath?: PatchPath
) {
	invariant(childValue !== parentValue, "Immer forbids circular references")

	// In the `finalizeTree` method, only the `root` object may be a draft.
	const isDraftProp = !!rootState && parentValue === root
	const isSetMember = isSet(parentValue)

	if (isDraft(childValue)) {
		const path =
			rootPath &&
			isDraftProp &&
			!isSetMember && // Set objects are atomic since they have no keys.
			!has((rootState as Exclude<ImmerState, SetState>).assigned_!, prop) // Skip deep patches for assigned keys.
				? rootPath!.concat(prop)
				: undefined

		// Drafts owned by `scope` are finalized here.
		childValue = finalize(immer, childValue, scope, path)
		set(parentValue, prop, childValue)

		// Drafts from another scope must prevent auto-freezing.
		if (isDraft(childValue)) {
			scope.canAutoFreeze_ = false
		}
	}
	// Unchanged draft properties are ignored.
	else if (isDraftProp && is(childValue, get(rootState.base_, prop))) {
		return
	}
	// Search new objects for unfinalized drafts. Frozen objects should never contain drafts.
	// TODO: the recursion over here looks weird, shouldn't non-draft stuff have it's own recursion?
	// especially the passing on of root and rootState doesn't make sense...
	else if (isDraftable(childValue)) {
		each(childValue, (key, grandChild) =>
			finalizeProperty(
				immer,
				scope,
				root,
				rootState,
				childValue,
				key,
				grandChild,
				rootPath
			)
		)
		if (!scope.parent_) maybeFreeze(immer, childValue)
	}

	if (isDraftProp && immer.onAssign && !isSetMember) {
		immer.onAssign(rootState, prop, childValue)
	}
}

export function maybeFreeze(immer: Immer, value: any, deep = false) {
	if (immer.autoFreeze && !isDraft(value)) {
		freeze(value, deep)
	}
}
