"use strict"
import {
	each,
	has,
	is,
	isDraftable,
	shallowCopy,
	latest,
	ImmerBaseState,
	ImmerState,
	Drafted,
	ProxyType,
	AnyObject,
	AnyArray,
	Objectish,
	ImmerScope,
	DRAFT_STATE
} from "./internal"

interface ProxyBaseState extends ImmerBaseState {
	assigned: {
		[property: string]: boolean
	}
	parent?: ImmerState
	drafts?: {
		[property: string]: Drafted<any, any>
	}
	revoke(): void
}

export interface ProxyObjectState extends ProxyBaseState {
	type: ProxyType.ProxyObject
	base: AnyObject
	copy: AnyObject | null
	draft: Drafted<AnyObject, ProxyObjectState>
}

export interface ProxyArrayState extends ProxyBaseState {
	type: ProxyType.ProxyArray
	base: AnyArray
	copy: AnyArray | null
	draft: Drafted<AnyArray, ProxyArrayState>
}

type ProxyState = ProxyObjectState | ProxyArrayState

/**
 * Returns a new draft of the `base` object.
 *
 * The second argument is the parent draft-state (used internally).
 */
export function createProxy<T extends Objectish>(
	base: T,
	parent?: ImmerState
): Drafted<T, ProxyState> {
	const isArray = Array.isArray(base)
	const state: ProxyState = {
		type: isArray ? ProxyType.ProxyArray : (ProxyType.ProxyObject as any),
		// Track which produce call this is associated with.
		scope: parent ? parent.scope : ImmerScope.current!,
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
		draft: null as any, // set below
		// Any property proxies.
		drafts: {},
		// The base copy with any updated values.
		copy: null,
		// Called by the `produce` function.
		revoke: null as any,
		isManual: false
	}

	// the traps must target something, a bit like the 'real' base.
	// but also, we need to be able to determine from the target what the relevant state is
	// (to avoid creating traps per instance to capture the state in closure,
	// and to avoid creating weird hidden properties as well)
	// So the trick is to use 'state' as the actual 'target'! (and make sure we intercept everything)
	// Note that in the case of an array, we put the state in an array to have better Reflect defaults ootb
	let target: T = state as any
	let traps: ProxyHandler<object | Array<any>> = objectTraps
	if (isArray) {
		target = [state] as any
		traps = arrayTraps
	}

	// TODO: optimization: might be faster, cheaper if we created a non-revocable proxy
	// and administrate revoking ourselves
	const {revoke, proxy} = Proxy.revocable(target, traps)
	state.draft = proxy as any
	state.revoke = revoke
	return proxy as any
}

/**
 * Object drafts
 */
const objectTraps: ProxyHandler<ProxyState> = {
	get(state, prop) {
		if (prop === DRAFT_STATE) return state
		let {drafts} = state

		// Check for existing draft in unmodified state.
		if (!state.modified && has(drafts, prop)) {
			return drafts![prop as any]
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
			// @ts-ignore
			drafts = state.copy
		}

		return (drafts![prop as any] = state.scope.immer.createProxy(value, state))
	},
	has(state, prop) {
		return prop in latest(state)
	},
	ownKeys(state) {
		return Reflect.ownKeys(latest(state))
	},
	set(state, prop: string /* strictly not, but helps TS */, value) {
		if (!state.modified) {
			const baseValue = peek(state.base, prop)
			// Optimize based on value's truthiness. Truthy values are guaranteed to
			// never be undefined, so we can avoid the `in` operator. Lastly, truthy
			// values may be drafts, but falsy values are never drafts.
			const isUnchanged = value
				? is(baseValue, value) || value === state.drafts![prop]
				: is(baseValue, value) && prop in state.base
			if (isUnchanged) return true
			prepareCopy(state)
			markChanged(state)
		}
		state.assigned[prop] = true
		// @ts-ignore
		state.copy![prop] = value
		return true
	},
	deleteProperty(state, prop: string) {
		// The `undefined` check is a fast path for pre-existing keys.
		if (peek(state.base, prop) !== undefined || prop in state.base) {
			state.assigned[prop] = false
			prepareCopy(state)
			markChanged(state)
		} else if (state.assigned[prop]) {
			// if an originally not assigned property was deleted
			delete state.assigned[prop]
		}
		// @ts-ignore
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
			desc.configurable =
				state.type !== ProxyType.ProxyArray || prop !== "length"
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

const arrayTraps: ProxyHandler<[ProxyArrayState]> = {}
each(objectTraps, (key, fn) => {
	// @ts-ignore
	arrayTraps[key] = function() {
		arguments[0] = arguments[0][0]
		return fn.apply(this, arguments)
	}
})
arrayTraps.deleteProperty = function(state, prop) {
	if (isNaN(parseInt(prop as any))) {
		throw new Error("Immer only supports deleting array indices") // prettier-ignore
	}
	return objectTraps.deleteProperty!.call(this, state[0], prop)
}
arrayTraps.set = function(state, prop, value) {
	if (prop !== "length" && isNaN(parseInt(prop as any))) {
		throw new Error("Immer only supports setting array indices and the 'length' property") // prettier-ignore
	}
	return objectTraps.set!.call(this, state[0], prop, value, state[0])
}

/**
 * Map drafts
 */

// Access a property without creating an Immer draft.
function peek(draft: Drafted, prop: PropertyKey): any {
	const state = draft[DRAFT_STATE]
	const desc = Reflect.getOwnPropertyDescriptor(
		state ? latest(state) : draft,
		prop
	)
	return desc && desc.value
}

export function markChanged(state: ImmerState) {
	if (!state.modified) {
		state.modified = true
		if (
			state.type === ProxyType.ProxyObject ||
			state.type === ProxyType.ProxyArray
		) {
			const copy = (state.copy = shallowCopy(state.base))
			each(state.drafts!, (key, value) => {
				// @ts-ignore
				copy[key] = value
			})
			state.drafts = undefined
		}

		if (state.parent) {
			markChanged(state.parent)
		}
	}
}

function prepareCopy(state: ProxyState) {
	if (!state.copy) {
		state.copy = shallowCopy(state.base)
	}
}
