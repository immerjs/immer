"use strict"
import {
	each,
	has,
	is,
	isDraft,
	isDraftable,
	isEnumerable,
	shallowCopy,
	latest,
	createHiddenProperty,
	ImmerScope,
	ImmerState,
	Drafted,
	AnyObject,
	Objectish,
	ImmerBaseState,
	AnyArray,
	ProxyType,
	MapState,
	SetState,
	DRAFT_STATE
} from "./internal"

interface ES5BaseState extends ImmerBaseState {
	finalizing: boolean
	assigned: {[key: string]: any}
	parent?: ImmerState
	revoked: boolean
}

export interface ES5ObjectState extends ES5BaseState {
	type: ProxyType.ES5Object
	draft: Drafted<AnyObject, ES5ObjectState>
	base: AnyObject
	copy: AnyObject | null
}

export interface ES5ArrayState extends ES5BaseState {
	type: ProxyType.ES5Array
	draft: Drafted<AnyObject, ES5ArrayState>
	base: AnyArray
	copy: AnyArray | null
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
): Drafted<T, ES5ObjectState | ES5ArrayState> {
	const isArray = Array.isArray(base)
	const draft = clonePotentialDraft(base)

	each(draft, prop => {
		proxyProperty(draft, prop, isArray || isEnumerable(base, prop))
	})

	const state: ES5ObjectState | ES5ArrayState = {
		type: isArray ? ProxyType.ES5Array : (ProxyType.ES5Object as any),
		scope: parent ? parent.scope : ImmerScope.current!,
		modified: false,
		finalizing: false,
		finalized: false,
		assigned: {},
		parent,
		base,
		draft,
		copy: null,
		revoked: false,
		isManual: false
	}

	createHiddenProperty(draft, DRAFT_STATE, state)
	return draft
}

// Access a property without creating an Immer draft.
function peek(draft: Drafted, prop: PropertyKey) {
	const state = draft[DRAFT_STATE]
	if (state && !state.finalizing) {
		state.finalizing = true
		const value = draft[prop]
		state.finalizing = false
		return value
	}
	return draft[prop]
}

function get(state: ES5State, prop: string | number) {
	assertUnrevoked(state)
	const value = peek(latest(state), prop)
	if (state.finalizing) return value
	// Create a draft if the value is unmodified.
	if (value === peek(state.base, prop) && isDraftable(value)) {
		prepareCopy(state)
		// @ts-ignore
		return (state.copy![prop] = state.scope.immer.createProxy(value, state))
	}
	return value
}

function set(state: ES5State, prop: string | number, value: any) {
	assertUnrevoked(state)
	state.assigned[prop] = true
	if (!state.modified) {
		if (is(value, peek(latest(state), prop))) return
		markChangedES5(state)
		prepareCopy(state)
	}
	// @ts-ignore
	state.copy![prop] = value
}

export function markChangedES5(state: ImmerState) {
	if (!state.modified) {
		state.modified = true
		if (state.parent) markChangedES5(state.parent)
	}
}

function prepareCopy(state: ES5State) {
	if (!state.copy) state.copy = clonePotentialDraft(state.base)
}

function clonePotentialDraft(base: Objectish) {
	const state = base && (base as any)[DRAFT_STATE]
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
const descriptors: {[prop: string]: PropertyDescriptor} = {}

function proxyProperty(
	draft: Drafted<any, ES5State>,
	prop: string | number,
	enumerable: boolean
) {
	let desc = descriptors[prop]
	if (desc) {
		desc.enumerable = enumerable
	} else {
		descriptors[prop] = desc = {
			configurable: true,
			enumerable,
			get(this: any) {
				return get(this[DRAFT_STATE], prop)
			},
			set(this: any, value) {
				set(this[DRAFT_STATE], prop, value)
			}
		}
	}
	Object.defineProperty(draft, prop, desc)
}

export function assertUnrevoked(state: ES5State | MapState | SetState) {
	if (state.revoked === true)
		throw new Error(
			"Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? " +
				JSON.stringify(latest(state))
		)
}

// This looks expensive, but only proxies are visited, and only objects without known changes are scanned.
function markChangesSweep(drafts: Drafted<any, ImmerState>[]) {
	// The natural order of drafts in the `scope` array is based on when they
	// were accessed. By processing drafts in reverse natural order, we have a
	// better chance of processing leaf nodes first. When a leaf node is known to
	// have changed, we can avoid any traversal of its ancestor nodes.
	for (let i = drafts.length - 1; i >= 0; i--) {
		const state = drafts[i][DRAFT_STATE]
		if (!state.modified) {
			switch (state.type) {
				case ProxyType.ES5Array:
					if (hasArrayChanges(state)) markChangedES5(state)
					break
				case ProxyType.ES5Object:
					if (hasObjectChanges(state)) markChangedES5(state)
					break
			}
		}
	}
}

function markChangesRecursively(object: any) {
	if (!object || typeof object !== "object") return
	const state = object[DRAFT_STATE]
	if (!state) return
	const {base, draft, assigned, type} = state
	if (type === ProxyType.ES5Object) {
		// Look for added keys.
		// TODO: looks quite duplicate to hasObjectChanges,
		// probably there is a faster way to detect changes, as sweep + recurse seems to do some
		// unnecessary work.
		// also: probably we can store the information we detect here, to speed up tree finalization!
		each(draft, key => {
			if ((key as any) === DRAFT_STATE) return
			// The `undefined` check is a fast path for pre-existing keys.
			if (base[key] === undefined && !has(base, key)) {
				assigned[key] = true
				markChangedES5(state)
			} else if (!assigned[key]) {
				// Only untouched properties trigger recursion.
				markChangesRecursively(draft[key])
			}
		})
		// Look for removed keys.
		each(base, key => {
			// The `undefined` check is a fast path for pre-existing keys.
			if (draft[key] === undefined && !has(draft, key)) {
				assigned[key] = false
				markChangedES5(state)
			}
		})
	} else if (type === ProxyType.ES5Array) {
		if (hasArrayChanges(state)) {
			markChangedES5(state)
			assigned.length = true
		}

		if (draft.length < base.length) {
			for (let i = draft.length; i < base.length; i++) assigned[i] = false
		} else {
			for (let i = base.length; i < draft.length; i++) assigned[i] = true
		}

		// Minimum count is enough, the other parts has been processed.
		const min = Math.min(draft.length, base.length)

		for (let i = 0; i < min; i++) {
			// Only untouched indices trigger recursion.
			if (assigned[i] === undefined) markChangesRecursively(draft[i])
		}
	}
}

function hasObjectChanges(state: ES5ObjectState) {
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

function hasArrayChanges(state: ES5ArrayState) {
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
