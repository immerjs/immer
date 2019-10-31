"use strict"
import {
	assign,
	each,
	has,
	is,
	isDraftable,
	isDraft,
	isMap,
	isSet,
	hasSymbol,
	shallowCopy,
	makeIterable,
	DRAFT_STATE,
	assignMap,
	assignSet,
	original,
	iterateMapValues,
	makeIterateSetValues
} from "./common"
import {ImmerScope} from "./scope"

// Do nothing before being finalized.
export function willFinalize() {}

/**
 * Returns a new draft of the `base` object.
 *
 * The second argument is the parent draft-state (used internally).
 */
export function createProxy(base, parent) {
	const scope = parent ? parent.scope : ImmerScope.current
	const state = {
		// Track which produce call this is associated with.
		scope,
		// True for both shallow and deep changes.
		modified: false,
		// Used during finalization.
		finalized: false,
		// Track which properties have been assigned (true) or deleted (false).
		assigned: {},
		// The parent draft state.
		parent,
		// The base state.
		base,
		// The base proxy.
		draft: null,
		// Any property proxies.
		drafts: {},
		// The base copy with any updated values.
		copy: null,
		// Called by the `produce` function.
		revoke: null
	}

	let target = state
	let traps = objectTraps
	if (Array.isArray(base)) {
		target = [state]
		traps = arrayTraps
	}
	// Map drafts must support object keys, so we use Map objects to track changes.
	else if (isMap(base)) {
		traps = mapTraps
		state.drafts = new Map()
		state.assigned = new Map()
	}
	// Set drafts use a Map object to track which of its values are drafted.
	// And we don't need the "assigned" property, because Set objects have no keys.
	else if (isSet(base)) {
		traps = setTraps
		state.drafts = new Map()
	}

	const {revoke, proxy} = Proxy.revocable(target, traps)

	state.draft = proxy
	state.revoke = revoke

	scope.drafts.push(proxy)
	return proxy
}

/**
 * Object drafts
 */

const objectTraps = {
	get(state, prop) {
		if (prop === DRAFT_STATE) return state
		let {drafts} = state

		// Check for existing draft in unmodified state.
		if (!state.modified && has(drafts, prop)) {
			return drafts[prop]
		}

		const value = latest(state)[prop]
		if (state.finalized || !isDraftable(value)) {
			return value
		}

		// Check for existing draft in modified state.
		if (state.modified) {
			// Assigned values are never drafted. This catches any drafts we created, too.
			if (value !== peek(state.base, prop)) return value
			// Store drafts on the copy (when one exists).
			drafts = state.copy
		}

		return (drafts[prop] = createProxy(value, state))
	},
	has(state, prop) {
		return prop in latest(state)
	},
	ownKeys(state) {
		return Reflect.ownKeys(latest(state))
	},
	set(state, prop, value) {
		if (!state.modified) {
			const baseValue = peek(state.base, prop)
			// Optimize based on value's truthiness. Truthy values are guaranteed to
			// never be undefined, so we can avoid the `in` operator. Lastly, truthy
			// values may be drafts, but falsy values are never drafts.
			const isUnchanged = value
				? is(baseValue, value) || value === state.drafts[prop]
				: is(baseValue, value) && prop in state.base
			if (isUnchanged) return true
			markChanged(state)
		}
		state.assigned[prop] = true
		state.copy[prop] = value
		return true
	},
	deleteProperty(state, prop) {
		// The `undefined` check is a fast path for pre-existing keys.
		if (peek(state.base, prop) !== undefined || prop in state.base) {
			state.assigned[prop] = false
			markChanged(state)
		} else if (state.assigned[prop]) {
			// if an originally not assigned property was deleted
			delete state.assigned[prop]
		}
		if (state.copy) delete state.copy[prop]
		return true
	},
	// Note: We never coerce `desc.value` into an Immer draft, because we can't make
	// the same guarantee in ES5 mode.
	getOwnPropertyDescriptor(state, prop) {
		const owner = latest(state)
		const desc = Reflect.getOwnPropertyDescriptor(owner, prop)
		if (desc) {
			desc.writable = true
			desc.configurable = !Array.isArray(owner) || prop !== "length"
		}
		return desc
	},
	defineProperty() {
		throw new Error("Object.defineProperty() cannot be used on an Immer draft") // prettier-ignore
	},
	getPrototypeOf(state) {
		return Object.getPrototypeOf(state.base)
	},
	setPrototypeOf() {
		throw new Error("Object.setPrototypeOf() cannot be used on an Immer draft") // prettier-ignore
	}
}

/**
 * Array drafts
 */

const arrayTraps = {}
each(objectTraps, (key, fn) => {
	arrayTraps[key] = function() {
		arguments[0] = arguments[0][0]
		return fn.apply(this, arguments)
	}
})
arrayTraps.deleteProperty = function(state, prop) {
	if (isNaN(parseInt(prop))) {
		throw new Error("Immer only supports deleting array indices") // prettier-ignore
	}
	return objectTraps.deleteProperty.call(this, state[0], prop)
}
arrayTraps.set = function(state, prop, value) {
	if (prop !== "length" && isNaN(parseInt(prop))) {
		throw new Error("Immer only supports setting array indices and the 'length' property") // prettier-ignore
	}
	return objectTraps.set.call(this, state[0], prop, value)
}

// Used by Map and Set drafts
const reflectTraps = makeReflectTraps([
	"ownKeys",
	"has",
	"set",
	"deleteProperty",
	"defineProperty",
	"getOwnPropertyDescriptor",
	"preventExtensions",
	"isExtensible",
	"getPrototypeOf"
])

/**
 * Map drafts
 */

const mapTraps = makeTrapsForGetters({
	[DRAFT_STATE]: state => state,
	size: state => latest(state).size,
	has: state => key => latest(state).has(key),
	set: state => (key, value) => {
		const values = latest(state)
		if (!values.has(key) || values.get(key) !== value) {
			markChanged(state)
			state.assigned.set(key, true)
			state.copy.set(key, value)
		}
		return state.draft
	},
	delete: state => key => {
		if (latest(state).has(key)) {
			markChanged(state)
			state.assigned.set(key, false)
			return state.copy.delete(key)
		}
		return false
	},
	clear: state => () => {
		markChanged(state)
		state.assigned = new Map()
		for (const key of latest(state).keys()) {
			state.assigned.set(key, false)
		}
		return state.copy.clear()
	},
	forEach: (state, _, receiver) => (cb, thisArg) =>
		latest(state).forEach((_, key, map) => {
			const value = receiver.get(key)
			cb.call(thisArg, value, key, map)
		}),
	get: state => key => {
		const drafts = state[state.modified ? "copy" : "drafts"]
		if (drafts.has(key)) {
			return drafts.get(key)
		}

		const value = latest(state).get(key)
		if (state.finalized || !isDraftable(value)) {
			return value
		}

		const draft = createProxy(value, state)
		drafts.set(key, draft)
		return draft
	},
	keys: state => () => latest(state).keys(),
	values: iterateMapValues,
	entries: iterateMapValues,
	[hasSymbol ? Symbol.iterator : "@@iterator"]: iterateMapValues
})

const iterateSetValues = makeIterateSetValues(createProxy)
/**
 * Set drafts
 */

const setTraps = makeTrapsForGetters({
	[DRAFT_STATE]: state => state,
	size: state => latest(state).size,
	has: state => key => latest(state).has(key),
	add: state => value => {
		if (!latest(state).has(value)) {
			markChanged(state)
			state.copy.add(value)
		}
		return state.draft
	},
	delete: state => value => {
		markChanged(state)
		return state.copy.delete(value)
	},
	clear: state => () => {
		markChanged(state)
		return state.copy.clear()
	},
	forEach: state => (cb, thisArg) => {
		const iterator = iterateSetValues(state)()
		let result = iterator.next()
		while (!result.done) {
			cb.call(thisArg, result.value, result.value, state.draft)
			result = iterator.next()
		}
	},
	keys: iterateSetValues,
	values: iterateSetValues,
	entries: iterateSetValues,
	[hasSymbol ? Symbol.iterator : "@@iterator"]: iterateSetValues
})

/**
 * Helpers
 */

// Retrieve the latest values of the draft.
function latest(state) {
	return state.copy || state.base
}

// Access a property without creating an Immer draft.
function peek(draft, prop) {
	const state = draft[DRAFT_STATE]
	const desc = Reflect.getOwnPropertyDescriptor(
		state ? latest(state) : draft,
		prop
	)
	return desc && desc.value
}

function markChanged(state) {
	if (!state.modified) {
		state.modified = true

		const {base, drafts, parent} = state
		const copy = shallowCopy(base)

		if (isSet(base)) {
			// Note: The `drafts` property is preserved for Set objects, since
			// we need to keep track of which values are drafted.
			assignSet(copy, drafts)
		} else {
			// Merge nested drafts into the copy.
			if (isMap(base)) assignMap(copy, drafts)
			else assign(copy, drafts)
			state.drafts = null
		}

		state.copy = copy
		if (parent) {
			markChanged(parent)
		}
	}
}

/** Create traps that all use the `Reflect` API on the `latest(state)` */
function makeReflectTraps(names) {
	return names.reduce((traps, name) => {
		traps[name] = (state, ...args) => Reflect[name](latest(state), ...args)
		return traps
	}, {})
}

function makeTrapsForGetters(getters) {
	return {
		...reflectTraps,
		get(state, prop, receiver) {
			return getters.hasOwnProperty(prop)
				? getters[prop](state, prop, receiver)
				: Reflect.get(state, prop, receiver)
		},
		setPrototypeOf(state) {
			throw new Error("Object.setPrototypeOf() cannot be used on an Immer draft") // prettier-ignore
		}
	}
}
