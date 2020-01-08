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
	shallowCopy
} from "./common"
import {isDraft, isDraftable} from "./index"
import {SetState} from "./set"
import {generatePatches} from "./patches"

type PatchPath = Array<string | number> | null

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
			result = finalize(immer, result, null, scope)
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
		result = finalize(immer, baseDraft, [], scope)
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
	path: PatchPath,
	scope: ImmerScope
) {
	const state = draft[DRAFT_STATE]
	if (!state) {
		if (Object.isFrozen(draft)) return draft
		return finalizeTree(immer, draft, null, scope)
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
		finalizeTree(immer, state.draft, path, scope)

		// We cannot really delete anything inside of a Set. We can only replace the whole Set.
		if (immer.onDelete && !isSet(state.base)) {
			// The `assigned` object is unreliable with ES5 drafts.
			if (immer.useProxies) {
				const {assigned} = state
				each(assigned, (prop, exists) => {
					if (!exists) immer.onDelete?.(state, prop as any)
				})
			} else {
				// TODO: Figure it out for Maps and Sets if we need to support ES5
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
	rootPath: PatchPath,
	scope: ImmerScope
) {
	const state = root[DRAFT_STATE]
	if (state) {
		// TODO: kill isMap / isSet here
		if (!immer.useProxies && !isMap(root) && !isSet(root)) {
			// Create the final copy, with added keys and without deleted keys.
			state.copy = shallowCopy(state.draft, true) // TODO: optimization, can we get rid of this and just use state.copy?
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
	parent: ImmerState,
	needPatches: boolean,
	scope: ImmerScope,
	rootPath: PatchPath
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
				: null

		// Drafts owned by `scope` are finalized here.
		value = finalize(immer, value, path, scope)
		replace(parent, prop, value)

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

function replace(parent: Drafted, prop: PropertyKey, value: any) {
	// TODO: kill isMap clal here
	if (isMap(parent)) {
		parent.set(prop, value)
	} else if (isSet(parent)) {
		// In this case, the `prop` is actually a draft.
		parent.delete(prop)
		parent.add(value)
	} else if (Array.isArray(parent) || isEnumerable(parent, prop)) {
		// Preserve non-enumerable properties.
		parent[prop] = value
	} else {
		Object.defineProperty(parent, prop, {
			value,
			writable: true,
			configurable: true
		})
	}
}

export function maybeFreeze(immer: Immer, value: any, deep = false) {
	if (immer.autoFreeze && !isDraft(value)) {
		freeze(value, deep)
	}
}
