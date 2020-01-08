"use strict"
import {
	each,
	has,
	is,
	isDraft,
	isDraftable,
	isEnumerable,
	isMap,
	isSet,
	shallowCopy,
	DRAFT_STATE,
	latest
} from "./common"

import {ImmerScope} from "./scope"
import {ImmerState, Drafted, AnyObject, AnyMap} from "./types"

// TODO: merge with ImmerState?
interface ES5BaseState {
	scope: ImmerScope
	modified: boolean
	finalizing: boolean
	finalized: boolean
	assigned: {[key: string]: any}
	parent?: ImmerState
	drafts: AnyMap | null // TODO: don't use map?
	revoke()
	revoked: boolean
}

export interface ES5ObjectState extends ES5BaseState {
	type: "es5_object"
	draft: Drafted<AnyObject, ES5ObjectState>
	base: AnyObject
	copy: AnyObject | null
}

export interface ES5ArrayState extends ES5BaseState {
	type: "es5_array"
	draft: Drafted<AnyObject, ES5ArrayState>
	base: AnyObject
	copy: AnyObject | null
}

type ES5State = ES5ArrayState | ES5ObjectState

export function willFinalizeES5(
	scope: ImmerScope,
	result: any,
	isReplaced: boolean
) {
	scope.drafts!.forEach(draft => {
		draft[DRAFT_STATE].finalizing = true
	})
	if (!isReplaced) {
		if (scope.patches) {
			markChangesRecursively(scope.drafts![0])
		}
		// This is faster when we don't care about which attributes changed.
		markChangesSweep(scope.drafts)
	}
	// When a child draft is returned, look for changes.
	else if (isDraft(result) && result[DRAFT_STATE].scope === scope) {
		markChangesSweep(scope.drafts)
	}
}

export function createES5Proxy<T>(
	base: T,
	parent?: ImmerState
): Drafted<any, ES5ObjectState | ES5ArrayState> {
	const isArray = Array.isArray(base)
	const draft = clonePotentialDraft(base)

	each(draft, prop => {
		proxyProperty(draft, prop, isArray || isEnumerable(base, prop))
	})

	const state: ES5ObjectState | ES5ArrayState = {
		type: isArray ? "es5_array" : ("es5_object" as any),
		scope: parent ? parent.scope : ImmerScope.current!,
		modified: false,
		finalizing: false, // es5 only
		finalized: false,
		assigned: {},
		parent,
		base,
		draft,
		drafts: null,
		copy: null,
		revoke,
		revoked: false // es5 only
	}

	createHiddenProperty(draft, DRAFT_STATE, state)
	return draft
}

function revoke(this: ES5BaseState) {
	this.revoked = true
}

// TODO: type these methods
// Access a property without creating an Immer draft.
function peek(draft, prop) {
	const state = draft[DRAFT_STATE]
	if (state && !state.finalizing) {
		state.finalizing = true
		const value = draft[prop]
		state.finalizing = false
		return value
	}
	return draft[prop]
}

function get(state, prop) {
	assertUnrevoked(state)
	const value = peek(latest(state), prop)
	if (state.finalizing) return value
	// Create a draft if the value is unmodified.
	if (value === peek(state.base, prop) && isDraftable(value)) {
		prepareCopy(state)
		return (state.copy[prop] = state.scope.immer.createProxy(value, state))
	}
	return value
}

function set(state: ES5State, prop, value) {
	assertUnrevoked(state)
	state.assigned[prop] = true
	if (!state.modified) {
		if (is(value, peek(latest(state), prop))) return
		markChangedES5(state)
		prepareCopy(state)
	}
	state.copy![prop] = value
}

export function markChangedES5(state) {
	if (!state.modified) {
		state.modified = true
		if (state.parent) markChangedES5(state.parent)
	}
}

function prepareCopy(state) {
	if (!state.copy) state.copy = clonePotentialDraft(state.base)
}

function clonePotentialDraft(base) {
	const state = base && base[DRAFT_STATE]
	if (state) {
		state.finalizing = true
		const draft = shallowCopy(state.draft, true)
		state.finalizing = false
		return draft
	}
	return shallowCopy(base)
}

// property descriptors are recycled to make sure we don't create a get and set closure per property,
// but share them all instead
const descriptors = {}

function proxyProperty(draft, prop, enumerable) {
	let desc = descriptors[prop]
	if (desc) {
		desc.enumerable = enumerable
	} else {
		descriptors[prop] = desc = {
			configurable: true,
			enumerable,
			get() {
				return get(this[DRAFT_STATE], prop)
			},
			set(value) {
				set(this[DRAFT_STATE], prop, value)
			}
		}
	}
	Object.defineProperty(draft, prop, desc)
}

export function assertUnrevoked(state) {
	if (state.revoked === true)
		throw new Error(
			"Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? " +
				JSON.stringify(latest(state))
		)
}

// This looks expensive, but only proxies are visited, and only objects without known changes are scanned.
function markChangesSweep(drafts) {
	// The natural order of drafts in the `scope` array is based on when they
	// were accessed. By processing drafts in reverse natural order, we have a
	// better chance of processing leaf nodes first. When a leaf node is known to
	// have changed, we can avoid any traversal of its ancestor nodes.
	for (let i = drafts.length - 1; i >= 0; i--) {
		const state = drafts[i][DRAFT_STATE]
		if (!state.modified) {
			if (Array.isArray(state.base)) {
				if (hasArrayChanges(state)) markChangedES5(state)
			} else if (isMap(state.base)) {
				// TODO: use switch
				continue
			} else if (isSet(state.base)) {
				continue
			} else if (hasObjectChanges(state)) {
				markChangedES5(state)
			}
		}
	}
}

// TODO: refactor this to work per object-type
// TODO: Set / Map shouldn't be ES specific
function markChangesRecursively(object) {
	if (!object || typeof object !== "object") return
	const state = object[DRAFT_STATE]
	if (!state) return
	const {base, draft, assigned} = state
	if (isSet(object) || isMap(object)) {
		// TODO: create switch here
		return
	} else if (!Array.isArray(object)) {
		// Look for added keys.
		// TODO: use each?
		Object.keys(draft).forEach(key => {
			// The `undefined` check is a fast path for pre-existing keys.
			if (base[key] === undefined && !has(base, key)) {
				// TODO: this code seems invalid for Maps!
				assigned[key] = true
				markChangedES5(state)
			} else if (!assigned[key]) {
				// TODO: === false ?
				// Only untouched properties trigger recursion.
				markChangesRecursively(draft[key])
			}
		})
		// Look for removed keys.
		// TODO: is this code needed?
		// TODO: use each?
		Object.keys(base).forEach(key => {
			// The `undefined` check is a fast path for pre-existing keys.
			if (draft[key] === undefined && !has(draft, key)) {
				assigned[key] = false
				markChangedES5(state)
			}
		})
	} else if (hasArrayChanges(state)) {
		markChangedES5(state)
		assigned.length = true
		if (draft.length < base.length) {
			for (let i = draft.length; i < base.length; i++) assigned[i] = false
		} else {
			for (let i = base.length; i < draft.length; i++) assigned[i] = true
		}
		for (let i = 0; i < draft.length; i++) {
			// Only untouched indices trigger recursion.
			if (assigned[i] === undefined) markChangesRecursively(draft[i])
		}
	}
}

function hasObjectChanges(state) {
	const {base, draft} = state

	// Search for added keys and changed keys. Start at the back, because
	// non-numeric keys are ordered by time of definition on the object.
	const keys = Object.keys(draft)
	for (let i = keys.length - 1; i >= 0; i--) {
		const key = keys[i]
		const baseValue = base[key]
		// The `undefined` check is a fast path for pre-existing keys.
		if (baseValue === undefined && !has(base, key)) {
			return true
		}
		// Once a base key is deleted, future changes go undetected, because its
		// descriptor is erased. This branch detects any missed changes.
		else {
			const value = draft[key]
			const state = value && value[DRAFT_STATE]
			if (state ? state.base !== baseValue : !is(value, baseValue)) {
				return true
			}
		}
	}

	// At this point, no keys were added or changed.
	// Compare key count to determine if keys were deleted.
	return keys.length !== Object.keys(base).length
}

function hasArrayChanges(state) {
	const {draft} = state
	if (draft.length !== state.base.length) return true
	// See #116
	// If we first shorten the length, our array interceptors will be removed.
	// If after that new items are added, result in the same original length,
	// those last items will have no intercepting property.
	// So if there is no own descriptor on the last position, we know that items were removed and added
	// N.B.: splice, unshift, etc only shift values around, but not prop descriptors, so we only have to check
	// the last one
	const descriptor = Object.getOwnPropertyDescriptor(draft, draft.length - 1)
	// descriptor can be null, but only for newly created sparse arrays, eg. new Array(10)
	if (descriptor && !descriptor.get) return true
	// For all other cases, we don't have to compare, as they would have been picked up by the index setters
	return false
}

function createHiddenProperty(target, prop, value) {
	Object.defineProperty(target, prop, {
		value: value,
		enumerable: false,
		writable: true
	})
}
