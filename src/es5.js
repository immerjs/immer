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
	hasSymbol,
	shallowCopy,
	DRAFT_STATE,
	iterateMapValues,
	makeIterable,
	makeIterateSetValues
} from "./common"
import {ImmerScope} from "./scope"

export function willFinalize(scope, result, isReplaced) {
	scope.drafts.forEach(draft => {
		draft[DRAFT_STATE].finalizing = true
	})
	if (!isReplaced) {
		if (scope.patches) {
			markChangesRecursively(scope.drafts[0])
		}
		// This is faster when we don't care about which attributes changed.
		markChangesSweep(scope.drafts)
	}
	// When a child draft is returned, look for changes.
	else if (isDraft(result) && result[DRAFT_STATE].scope === scope) {
		markChangesSweep(scope.drafts)
	}
}

export function createProxy(base, parent) {
	const isArray = Array.isArray(base)
	const draft = clonePotentialDraft(base)

	if (isMap(base)) {
		proxyMap(draft)
	} else if (isSet(base)) {
		proxySet(draft)
	} else {
		each(draft, prop => {
			proxyProperty(draft, prop, isArray || isEnumerable(base, prop))
		})
	}

	// See "proxy.js" for property documentation.
	const scope = parent ? parent.scope : ImmerScope.current
	const state = {
		scope,
		modified: false,
		finalizing: false, // es5 only
		finalized: false,
		assigned: isMap(base) ? new Map() : {},
		parent,
		base,
		draft,
		drafts: isSet(base) ? new Map() : null,
		copy: null,
		revoke,
		revoked: false // es5 only
	}

	createHiddenProperty(draft, DRAFT_STATE, state)
	scope.drafts.push(draft)
	return draft
}

function revoke() {
	this.revoked = true
}

function latest(state) {
	return state.copy || state.base
}

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
		return (state.copy[prop] = createProxy(value, state))
	}
	return value
}

function set(state, prop, value) {
	assertUnrevoked(state)
	state.assigned[prop] = true
	if (!state.modified) {
		if (is(value, peek(latest(state), prop))) return
		markChanged(state)
		prepareCopy(state)
	}
	state.copy[prop] = value
}

function markChanged(state) {
	if (!state.modified) {
		state.modified = true
		if (state.parent) markChanged(state.parent)
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

function proxyMap(target) {
	Object.defineProperties(target, mapTraps)

	if (hasSymbol) {
		Object.defineProperty(
			target,
			Symbol.iterator,
			proxyMethod(iterateMapValues)
		)
	}
}

const mapTraps = finalizeTraps({
	size: state => latest(state).size,
	has: state => key => latest(state).has(key),
	set: state => (key, value) => {
		if (latest(state).get(key) !== value) {
			prepareCopy(state)
			markChanged(state)
			state.assigned.set(key, true)
			state.copy.set(key, value)
		}
		return state.draft
	},
	delete: state => key => {
		prepareCopy(state)
		markChanged(state)
		state.assigned.set(key, false)
		state.copy.delete(key)
		return false
	},
	clear: state => () => {
		if (!state.copy) {
			prepareCopy(state)
		}
		markChanged(state)
		state.assigned = new Map()
		for (const key of latest(state).keys()) {
			state.assigned.set(key, false)
		}
		return state.copy.clear()
	},
	forEach: (state, key, reciever) => cb => {
		latest(state).forEach((value, key, map) => {
			cb(reciever.get(key), key, map)
		})
	},
	get: state => key => {
		const value = latest(state).get(key)

		if (state.finalizing || state.finalized || !isDraftable(value)) {
			return value
		}

		if (value !== state.base.get(key)) {
			return value
		}
		const draft = createProxy(value, state)
		prepareCopy(state)
		state.copy.set(key, draft)
		return draft
	},
	keys: state => () => latest(state).keys(),
	values: iterateMapValues,
	entries: iterateMapValues
})

function proxySet(target) {
	Object.defineProperties(target, setTraps)

	if (hasSymbol) {
		Object.defineProperty(
			target,
			Symbol.iterator,
			proxyMethod(iterateSetValues)
		)
	}
}

const iterateSetValues = makeIterateSetValues(createProxy)

const setTraps = finalizeTraps({
	size: state => {
		return latest(state).size
	},
	add: state => value => {
		if (!latest(state).has(value)) {
			markChanged(state)
			if (!state.copy) {
				prepareCopy(state)
			}
			state.copy.add(value)
		}
		return state.draft
	},
	delete: state => value => {
		markChanged(state)
		if (!state.copy) {
			prepareCopy(state)
		}
		return state.copy.delete(value)
	},
	has: state => key => {
		return latest(state).has(key)
	},
	clear: state => () => {
		markChanged(state)
		if (!state.copy) {
			prepareCopy(state)
		}
		return state.copy.clear()
	},
	keys: iterateSetValues,
	entries: iterateSetValues,
	values: iterateSetValues,
	forEach: state => (cb, thisArg) => {
		const iterator = iterateSetValues(state)()
		let result = iterator.next()
		while (!result.done) {
			cb.call(thisArg, result.value, result.value, state.draft)
			result = iterator.next()
		}
	}
})

function finalizeTraps(traps) {
	return Object.keys(traps).reduce(function(acc, key) {
		const builder = key === "size" ? proxyAttr : proxyMethod
		acc[key] = builder(traps[key], key)
		return acc
	}, {})
}

function proxyAttr(fn) {
	return {
		get() {
			const state = this[DRAFT_STATE]
			assertUnrevoked(state)
			return fn(state)
		}
	}
}

function proxyMethod(trap, key) {
	return {
		get() {
			return function(...args) {
				const state = this[DRAFT_STATE]
				assertUnrevoked(state)
				return trap(state, key, state.draft)(...args)
			}
		}
	}
}

function assertUnrevoked(state) {
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
				if (hasArrayChanges(state)) markChanged(state)
			} else if (isMap(state.base)) {
				if (hasMapChanges(state)) markChanged(state)
			} else if (isSet(state.base)) {
				if (hasSetChanges(state)) markChanged(state)
			} else if (hasObjectChanges(state)) {
				markChanged(state)
			}
		}
	}
}

function markChangesRecursively(object) {
	if (!object || typeof object !== "object") return
	const state = object[DRAFT_STATE]
	if (!state) return
	const {base, draft, assigned} = state
	if (!Array.isArray(object)) {
		// Look for added keys.
		Object.keys(draft).forEach(key => {
			// The `undefined` check is a fast path for pre-existing keys.
			if (base[key] === undefined && !has(base, key)) {
				assigned[key] = true
				markChanged(state)
			} else if (!assigned[key]) {
				// Only untouched properties trigger recursion.
				markChangesRecursively(draft[key])
			}
		})
		// Look for removed keys.
		Object.keys(base).forEach(key => {
			// The `undefined` check is a fast path for pre-existing keys.
			if (draft[key] === undefined && !has(draft, key)) {
				assigned[key] = false
				markChanged(state)
			}
		})
	} else if (hasArrayChanges(state)) {
		markChanged(state)
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

function hasMapChanges(state) {
	const {base, draft} = state

	if (base.size !== draft.size) return true

	// IE11 supports only forEach iteration
	let hasChanges = false
	draft.forEach(function(value, key) {
		if (!hasChanges) {
			hasChanges = isDraftable(value) ? value.modified : value !== base.get(key)
		}
	})
	return hasChanges
}

function hasSetChanges(state) {
	const {base, draft} = state

	if (base.size !== draft.size) return true

	// IE11 supports only forEach iteration
	let hasChanges = false
	draft.forEach(function(value, key) {
		if (!hasChanges) {
			hasChanges = isDraftable(value) ? value.modified : !base.has(key)
		}
	})
	return hasChanges
}

function createHiddenProperty(target, prop, value) {
	Object.defineProperty(target, prop, {
		value: value,
		enumerable: false,
		writable: true
	})
}
