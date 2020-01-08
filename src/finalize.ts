import {Immer} from "./immer"
import {ImmerState, Drafted} from "./types"
import {ImmerScope} from "./scope"
import {
	isSet,
	has,
	is,
	get,
	each,
	isMap,
	isEnumerable,
	DRAFT_STATE,
	NOTHING,
	freeze,
	shallowCopy,
	set
} from "./common"
import {isDraft, isDraftable} from "./index"
import {SetState} from "./set"
import {generatePatches, PatchPath} from "./patches"

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
		if (immer.onDelete && !isSet(state.base)) {
			// The `assigned` object is unreliable with ES5 drafts.
			if (immer.useProxies) {
				const {assigned} = state
				each(assigned, (prop, exists) => {
					if (!exists) immer.onDelete?.(state, prop as any)
				})
			} else {
				const {base, copy} = state
				each(base, prop => {
					if (!has(copy, prop)) immer.onDelete?.(state, prop as any)
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
		if (state.type === "es5_object" || state.type === "es5_array") {
			// Create the final copy, with added keys and without deleted keys.
			state.copy = shallowCopy(state.draft, true)
		}
		root = state.copy
	}
	const needPatches = !!rootPath && !!scope.patches
	each(root, (key, value) =>
		finalizeProperty(
			immer,
			root,
			state,
			key,
			value,
			root,
			needPatches,
			scope,
			rootPath
		)
	)
	return root
}

function finalizeProperty(
	// TODO: can do with less args?
	immer: Immer,
	root: ImmerState,
	state: ImmerState,
	prop: string | number,
	value: any,
	parent: Drafted,
	needPatches: boolean,
	scope: ImmerScope,
	rootPath?: PatchPath
) {
	if (value === parent) {
		throw Error("Immer forbids circular references")
	}

	// In the `finalizeTree` method, only the `root` object may be a draft.
	const isDraftProp = !!state && parent === root
	const isSetMember = isSet(parent)

	if (isDraft(value)) {
		const path =
			isDraftProp &&
			needPatches &&
			!isSetMember && // Set objects are atomic since they have no keys.
			!has((state as Exclude<ImmerState, SetState>).assigned!, prop) // Skip deep patches for assigned keys.
				? rootPath!.concat(prop)
				: undefined

		// Drafts owned by `scope` are finalized here.
		value = finalize(immer, value, scope, path)
		set(parent, prop, value)

		// Drafts from another scope must prevent auto-freezing.
		if (isDraft(value)) {
			scope.canAutoFreeze = false
		}

		// Unchanged drafts are never passed to the `onAssign` hook.
		// if (isDraftProp && !isSet && value === get(state.base, prop)) return
	}
	// Unchanged draft properties are ignored.
	else if (isDraftProp && is(value, get(state.base, prop))) {
		return
	}
	// Search new objects for unfinalized drafts. Frozen objects should never contain drafts.
	else if (isDraftable(value) && !Object.isFrozen(value)) {
		each(value, (key, v) =>
			finalizeProperty(
				immer,
				root,
				state,
				key,
				v,
				value,
				needPatches,
				scope,
				rootPath
			)
		)
		maybeFreeze(immer, value)
	}

	if (isDraftProp && immer.onAssign && !isSetMember) {
		immer.onAssign(state, prop, value)
	}
}

export function maybeFreeze(immer: Immer, value: any, deep = false) {
	if (immer.autoFreeze && !isDraft(value)) {
		freeze(value, deep)
	}
}
