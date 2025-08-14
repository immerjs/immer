import {
	ImmerScope,
	DRAFT_STATE,
	isDraftable,
	NOTHING,
	PatchPath,
	each,
	has,
	freeze,
	ImmerState,
	isDraft,
	SetState,
	set,
	ArchType,
	getPlugin,
	die,
	revokeScope,
	isFrozen,
	createProxy,
	enterScope,
	markChanged,
	latest,
} from "../internal"

export function processResult(
	result: any,
	scope: ImmerScope
) {
	scope.unfinalizedDrafts_ = scope.drafts_.length
	const baseDraft = scope.drafts_![0]
	const isReplaced = result !== undefined && result !== baseDraft
	if (isReplaced) {
		if (baseDraft[DRAFT_STATE].modified_) {
			revokeScope(scope)
			die(4)
		}
		if (isDraftable(result)) {
			// Finalize the result in case it contains (or is) a subset of the draft.
			result = enterFinalize(scope, result)
		}
		if (scope.patches_) {
			getPlugin("Patches").generateReplacementPatches_(
				baseDraft[DRAFT_STATE].base_,
				result,
				scope.patches_,
				scope.inversePatches_!
			)
		}
	} else {
		// Finalize the base draft.
		result = enterFinalize(scope, baseDraft)
	}
	revokeScope(scope)
	if (scope.patches_) {
		scope.patchListener_!(scope.patches_, scope.inversePatches_!)
	}
	return result !== NOTHING ? result : undefined
}

// If we have an existingStateMap, enter a second scope while finalize the draft to catch any proxies we create during the process.
// That way, we can catch any deeply-nested objects which weren't drafted in the recipe WITHOUT modifying the original state.
// see the `multiref.ts`  test "replacing a deeply-nested value modified elsewhere does not modify the original object"
function enterFinalize(
	scope: ImmerScope,
	value: any
) {
	let secondScope = null;
	
	try {
		if (scope.existingStateMap_) {
			secondScope = enterScope(scope.immer_)
			secondScope.parent_ = scope
			secondScope.existingStateMap_ = scope.existingStateMap_
			if (!isDraft(value)) {
				value = createProxy(value, undefined)
			}
		}

		value = finalize(scope, secondScope, value, [])
	} finally {
		if (secondScope) {
			revokeScope(secondScope)
		}
	}

	if (!scope.parent_) maybeFreeze(scope, value, false)
	return value
}

function finalizeIfIsDraft(
	rootScope: ImmerScope,
	secondScope: ImmerScope | null,
	value: any,
	path?: PatchPath,
	encounteredObjects = new WeakSet<any>(),
): any {
	if (isDraft(value)) {
		return finalize(rootScope, secondScope, value, path, encounteredObjects)
	}
	return value
}

function finalize(
	rootScope: ImmerScope,
	secondScope: ImmerScope | null,
	value: any,
	path?: PatchPath,
	encounteredObjects = new WeakSet<any>(),
): any {
	let state: ImmerState | undefined = value[DRAFT_STATE]

	// Never finalize drafts owned by another scope.
	if (state && state.scope_ !== rootScope && state.scope_ !== secondScope) return value

	// Don't recurse into recursive data structures
	if (isFrozen(value) || encounteredObjects.has(state ? state.base_ : value)) return state ? (state.modified_? state.copy_ : state.base_) : value
	encounteredObjects.add(state ? state.base_ : value)
	if (state?.copy_) encounteredObjects.add(state.copy_)


	// A plain object, might need freezing, might contain drafts
	if (!state || (!state.modified_ && state.scope_.existingStateMap_)) {
		each(
			value,
			(key, childValue) =>
				finalizeProperty(
					rootScope,
					secondScope,
					state,
					value,
					key,
					childValue,
					path,
					undefined,
					encounteredObjects
				)
		)

		if (!state) return finalizeIfIsDraft(rootScope, secondScope, value, path, encounteredObjects)
	}
	// Unmodified draft, return the (frozen) original
	if (!state.modified_) {
		maybeFreeze(rootScope, state.base_, true)
		return finalizeIfIsDraft(rootScope, secondScope, state.base_, path, encounteredObjects)
	}
	// Not finalized yet, let's do that now
	if (!state.finalized_) {
		state.finalized_ = true
		state.scope_.unfinalizedDrafts_--
		const result = state.copy_
		// Finalize all children of the copy
		// For sets we clone before iterating, otherwise we can get in endless loop due to modifying during iteration, see #628
		// To preserve insertion order in all cases we then clear the set
		// And we let finalizeProperty know it needs to re-add non-draft children back to the target
		let resultEach = result
		let isSet = false
		if (state.type_ === ArchType.Set) {
			resultEach = new Set(result)
			result.clear()
			isSet = true
		}
		each(resultEach, (key, childValue) =>
			finalizeProperty(
				rootScope,
				secondScope,
				state,
				result,
				key,
				childValue,
				path,
				isSet,
				encounteredObjects
			)
		)
		// everything inside is frozen, we can freeze here
		maybeFreeze(rootScope, result, false)
		// first time finalizing, let's create those patches
		if (path && rootScope.patches_) {
			getPlugin("Patches").generatePatches_(
				state,
				path,
				rootScope.patches_,
				rootScope.inversePatches_!
			)
		}
	}

	return finalizeIfIsDraft(rootScope, secondScope, state.copy_, path, encounteredObjects)
}

function finalizeProperty(
	rootScope: ImmerScope,
	secondScope: ImmerScope | null,
	parentState: undefined | ImmerState,
	targetObject: any,
	prop: string | number,
	childValue: any,
	rootPath?: PatchPath,
	targetIsSet?: boolean,
	encounteredObjects = new WeakSet<any>()
) {
	if (!rootScope.existingStateMap_) {
		if (process.env.NODE_ENV !== "production" && childValue === targetObject)
			die(5)
	} else {
		if (!isDraft(childValue) && isDraftable(childValue)) {
			const existingState = rootScope.existingStateMap_.get(childValue)
			if (existingState) {
				childValue = existingState.draft_
			} else {
				childValue = createProxy(childValue, parentState)
			}
		}
	}


	if (isDraft(childValue)) {
		const path =
			rootPath &&
			parentState &&
			parentState!.type_ !== ArchType.Set && // Set objects are atomic since they have no keys.
			!has((parentState as Exclude<ImmerState, SetState>).assigned_!, prop) // Skip deep patches for assigned keys.
				? rootPath!.concat(prop)
				: undefined

		// Drafts owned by `scope` are finalized here.
		const state = childValue[DRAFT_STATE]
		const res = finalize(rootScope, secondScope, childValue, path, encounteredObjects)
		set(targetObject, prop, res)

		// Drafts from another scope must prevented to be frozen
		// if we got a draft back from finalize, we're in a nested produce and shouldn't freeze

		if (parentState && rootScope.existingStateMap_ && state.modified_) {
			markChanged(parentState)
		}

		if (isDraft(res)) {
			rootScope.canAutoFreeze_ = false
		} else return
	} else if (targetIsSet) {
		targetObject.add(childValue)
	}

	// Search new objects for unfinalized drafts. Frozen objects should never contain drafts.
	if (isDraftable(childValue) && !isFrozen(childValue)) {
		if (!rootScope.immer_.autoFreeze_ && rootScope.unfinalizedDrafts_ < 1) {
			// optimization: if an object is not a draft, and we don't have to
			// deepfreeze everything, and we are sure that no drafts are left in the remaining object
			// cause we saw and finalized all drafts already; we can stop visiting the rest of the tree.
			// This benefits especially adding large data tree's without further processing.
			// See add-data.js perf test
			return
		}
		finalize(
			rootScope,
			secondScope,
			childValue,
			undefined,
			encounteredObjects
		)
		// Immer deep freezes plain objects, so if there is no parent state, we freeze as well
		// Per #590, we never freeze symbolic properties. Just to make sure don't accidentally interfere
		// with other frameworks.
		if (
			(!parentState || !parentState.scope_.parent_) &&
			typeof prop !== "symbol" &&
			Object.prototype.propertyIsEnumerable.call(targetObject, prop)
		)
			maybeFreeze(rootScope, childValue)
	}
}

function maybeFreeze(rootScope: ImmerScope, value: any, deep = false) {
	// we never freeze for a non-root scope; as it would prevent pruning for drafts inside wrapping objects
	if (!rootScope.parent_ && rootScope.immer_.autoFreeze_ && rootScope.canAutoFreeze_) {
		freeze(value, deep)
	}
}
