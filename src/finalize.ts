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
	get
} from "./internal"

export function processResult(immer: Immer, result: any, scope: ImmerScope) {
	const baseDraft = scope.drafts![0]
	const isReplaced = result !== undefined && result !== baseDraft
	immer.willFinalize(scope, result, isReplaced)
	if (isReplaced) {
		if (baseDraft[DRAFT_STATE].modified) {
			scope.revoke()
			throw new Error("An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.") // prettier-ignore
		}
		if (isDraftable(result)) {
			// Finalize the result in case it contains (or is) a subset of the draft.
			result = finalize(immer, result, scope)
			maybeFreeze(immer, result)
		}
		if (scope.patches) {
			scope.patches.push({
				op: "replace",
				path: [],
				value: result
			})
			scope.inversePatches!.push({
				op: "replace",
				path: [],
				value: baseDraft[DRAFT_STATE].base
			})
		}
	} else {
		// Finalize the base draft.
		result = finalize(immer, baseDraft, scope, [])
	}
	scope.revoke()
	if (scope.patches) {
		scope.patchListener!(scope.patches, scope.inversePatches!)
	}
	return result !== NOTHING ? result : undefined
}

function finalize(
	immer: Immer,
	draft: Drafted,
	scope: ImmerScope,
	path?: PatchPath
) {
	const state = draft[DRAFT_STATE]
	if (!state) {
		if (Object.isFrozen(draft)) return draft
		return finalizeTree(immer, draft, scope)
	}
	// Never finalize drafts owned by another scope.
	if (state.scope !== scope) {
		return draft
	}
	if (!state.modified) {
		maybeFreeze(immer, state.base, true)
		return state.base
	}
	if (!state.finalized) {
		state.finalized = true
		finalizeTree(immer, state.draft, scope, path)

		// We cannot really delete anything inside of a Set. We can only replace the whole Set.
		if (immer.onDelete && state.type !== ProxyType.Set) {
			// The `assigned` object is unreliable with ES5 drafts.
			if (immer.useProxies) {
				const {assigned} = state
				each(assigned, (prop, exists) => {
					if (!exists) immer.onDelete!(state, prop as any)
				})
			} else {
				const {base, copy} = state
				each(base, prop => {
					if (!has(copy, prop)) immer.onDelete!(state, prop as any)
				})
			}
		}
		if (immer.onCopy) {
			immer.onCopy(state)
		}

		// At this point, all descendants of `state.copy` have been finalized,
		// so we can be sure that `scope.canAutoFreeze` is accurate.
		if (immer.autoFreeze && scope.canAutoFreeze) {
			freeze(state.copy, false)
		}

		if (path && scope.patches) {
			generatePatches(state, path, scope.patches, scope.inversePatches!)
		}
	}
	return state.copy
}

function finalizeTree(
	immer: Immer,
	root: Drafted,
	scope: ImmerScope,
	rootPath?: PatchPath
) {
	const state = root[DRAFT_STATE]
	if (state) {
		if (
			state.type === ProxyType.ES5Object ||
			state.type === ProxyType.ES5Array
		) {
			// Create the final copy, with added keys and without deleted keys.
			state.copy = shallowCopy(state.draft, true)
		}
		root = state.copy
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
	if (childValue === parentValue) {
		throw Error("Immer forbids circular references")
	}

	// In the `finalizeTree` method, only the `root` object may be a draft.
	const isDraftProp = !!rootState && parentValue === root
	const isSetMember = isSet(parentValue)

	if (isDraft(childValue)) {
		const path =
			rootPath &&
			isDraftProp &&
			!isSetMember && // Set objects are atomic since they have no keys.
			!has((rootState as Exclude<ImmerState, SetState>).assigned!, prop) // Skip deep patches for assigned keys.
				? rootPath!.concat(prop)
				: undefined

		// Drafts owned by `scope` are finalized here.
		childValue = finalize(immer, childValue, scope, path)
		set(parentValue, prop, childValue)

		// Drafts from another scope must prevent auto-freezing.
		if (isDraft(childValue)) {
			scope.canAutoFreeze = false
		}
	}
	// Unchanged draft properties are ignored.
	else if (isDraftProp && is(childValue, get(rootState.base, prop))) {
		return
	}
	// Search new objects for unfinalized drafts. Frozen objects should never contain drafts.
	// TODO: the recursion over here looks weird, shouldn't non-draft stuff have it's own recursion?
	// especially the passing on of root and rootState doesn't make sense...
	else if (isDraftable(childValue) && !Object.isFrozen(childValue)) {
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
		maybeFreeze(immer, childValue)
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
