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
	AnyObject,
	AnyArray,
	Objectish,
	getCurrentScope,
	DRAFT_STATE,
	die,
	createProxy,
	ProxyTypeProxyObject,
	ProxyTypeProxyArray
} from "../internal"

interface ProxyBaseState extends ImmerBaseState {
	assigned_: {
		[property: string]: boolean
	}
	parent_?: ImmerState
	drafts_?: {
		[property: string]: Drafted<any, any>
	}
	revoke_(): void
}

export interface ProxyObjectState extends ProxyBaseState {
	type_: typeof ProxyTypeProxyObject
	base_: AnyObject
	copy_: AnyObject | null
	draft_: Drafted<AnyObject, ProxyObjectState>
}

export interface ProxyArrayState extends ProxyBaseState {
	type_: typeof ProxyTypeProxyArray
	base_: AnyArray
	copy_: AnyArray | null
	draft_: Drafted<AnyArray, ProxyArrayState>
}

type ProxyState = ProxyObjectState | ProxyArrayState

/**
 * Returns a new draft of the `base` object.
 *
 * The second argument is the parent draft-state (used internally).
 */
export function createProxyProxy<T extends Objectish>(
	base: T,
	parent?: ImmerState
): Drafted<T, ProxyState> {
	const isArray = Array.isArray(base)
	const state: ProxyState = {
		type_: isArray ? ProxyTypeProxyArray : (ProxyTypeProxyObject as any),
		// Track which produce call this is associated with.
		scope_: parent ? parent.scope_ : getCurrentScope()!,
		// True for both shallow and deep changes.
		modified_: false,
		// Used during finalization.
		finalized_: false,
		// Track which properties have been assigned (true) or deleted (false).
		assigned_: {},
		// The parent draft state.
		parent_: parent,
		// The base state.
		base_: base,
		// The base proxy.
		draft_: null as any, // set below
		// Any property proxies.
		drafts_: {},
		// The base copy with any updated values.
		copy_: null,
		// Called by the `produce` function.
		revoke_: null as any,
		isManual_: false
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

	const {revoke, proxy} = Proxy.revocable(target, traps)
	state.draft_ = proxy as any
	state.revoke_ = revoke
	return proxy as any
}

/**
 * Object drafts
 */
const objectTraps: ProxyHandler<ProxyState> = {
	get(state, prop) {
		if (prop === DRAFT_STATE) return state
		let {drafts_: drafts} = state

		// Check for existing draft in unmodified state.
		if (!state.modified_ && has(drafts, prop)) {
			return drafts![prop as any]
		}

		const value = latest(state)[prop]
		if (state.finalized_ || !isDraftable(value)) {
			return value
		}

		// Check for existing draft in modified state.
		if (state.modified_) {
			// Assigned values are never drafted. This catches any drafts we created, too.
			if (value !== peek(state.base_, prop)) return value
			// Store drafts on the copy (when one exists).
			// @ts-ignore
			drafts = state.copy_
		}

		return (drafts![prop as any] = createProxy(
			state.scope_.immer_,
			value,
			state
		))
	},
	has(state, prop) {
		return prop in latest(state)
	},
	ownKeys(state) {
		return Reflect.ownKeys(latest(state))
	},
	set(state, prop: string /* strictly not, but helps TS */, value) {
		if (!state.modified_) {
			const baseValue = peek(state.base_, prop)
			// Optimize based on value's truthiness. Truthy values are guaranteed to
			// never be undefined, so we can avoid the `in` operator. Lastly, truthy
			// values may be drafts, but falsy values are never drafts.
			const isUnchanged = value
				? is(baseValue, value) || value === state.drafts_![prop]
				: is(baseValue, value) && prop in state.base_
			if (isUnchanged) return true
			prepareCopy(state)
			markChangedProxy(state)
		}
		state.assigned_[prop] = true
		// @ts-ignore
		state.copy_![prop] = value
		return true
	},
	deleteProperty(state, prop: string) {
		// The `undefined` check is a fast path for pre-existing keys.
		if (peek(state.base_, prop) !== undefined || prop in state.base_) {
			state.assigned_[prop] = false
			prepareCopy(state)
			markChangedProxy(state)
		} else if (state.assigned_[prop]) {
			// if an originally not assigned property was deleted
			delete state.assigned_[prop]
		}
		// @ts-ignore
		if (state.copy_) delete state.copy_[prop]
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
				state.type_ !== ProxyTypeProxyArray || prop !== "length"
		}
		return desc
	},
	defineProperty() {
		die(11)
	},
	getPrototypeOf(state) {
		return Object.getPrototypeOf(state.base_)
	},
	setPrototypeOf() {
		die(12)
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
	if (__DEV__ && isNaN(parseInt(prop as any))) die(13)
	return objectTraps.deleteProperty!.call(this, state[0], prop)
}
arrayTraps.set = function(state, prop, value) {
	if (__DEV__ && prop !== "length" && isNaN(parseInt(prop as any))) die(14)
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

export function markChangedProxy(state: ImmerState) {
	if (!state.modified_) {
		state.modified_ = true
		if (
			state.type_ === ProxyTypeProxyObject ||
			state.type_ === ProxyTypeProxyArray
		) {
			const copy = (state.copy_ = shallowCopy(state.base_))
			each(state.drafts_!, (key, value) => {
				// @ts-ignore
				copy[key] = value
			})
			state.drafts_ = undefined
		}

		if (state.parent_) {
			markChangedProxy(state.parent_)
		}
	}
}

function prepareCopy(state: ProxyState) {
	if (!state.copy_) {
		state.copy_ = shallowCopy(state.base_)
	}
}
