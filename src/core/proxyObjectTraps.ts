import {
	has,
	is,
	isDraftable,
	latest,
	DRAFT_STATE,
	die,
	createProxy,
	ProxyTypeProxyArray,
	ImmerState,
	shallowCopy,
	Drafted
} from "../internal"
import {ProxyObjectState, ProxyState} from "./proxyStateTypes"

/**
 * Object drafts
 */
export const objectTraps: ProxyHandler<ProxyState> = {
	get(state, prop) {
		if (prop === DRAFT_STATE) return state

		const source = latest(state)
		if (!has(source, prop)) {
			// non-existing or non-own property...
			return readPropFromProto(state, source, prop)
		}
		const value = source[prop]
		if (state.finalized_ || !isDraftable(value)) {
			return value
		}
		// Check for existing draft in modified state.
		// Assigned values are never drafted. This catches any drafts we created, too.
		if (value === peek(state.base_, prop)) {
			prepareCopy(state)
			return (state.copy_![prop as any] = createProxy(
				state.scope_.immer_,
				value,
				state
			))
		}
		return value
	},
	has(state, prop) {
		return prop in latest(state)
	},
	ownKeys(state) {
		return Reflect.ownKeys(latest(state))
	},
	set(
		state: ProxyObjectState,
		prop: string /* strictly not, but helps TS */,
		value
	) {
		const desc = getDescriptorFromProto(latest(state), prop)
		if (desc?.set) {
			// special case: if this write is captured by a setter, we have
			// to trigger it with the correct context
			desc.set.call(state.draft_, value)
			return true
		}
		if (!state.modified_) {
			// the last check is because we need to be able to distinguish setting a non-existig to undefined (which is a change)
			// from setting an existing property with value undefined to undefined (which is not a change)
			const current = peek(latest(state), prop)
			// special case, if we assigning the original value to a draft, we can ignore the assignment
			const currentState: ProxyObjectState = current?.[DRAFT_STATE]
			if (currentState && currentState.base_ === value) {
				state.copy_![prop] = value
				state.assigned_[prop] = false
				return true
			}
			if (is(value, current) && (value !== undefined || has(state.base_, prop)))
				return true
			prepareCopy(state)
			markChanged(state)
		}
		// @ts-ignore
		state.copy_![prop] = value
		state.assigned_[prop] = true
		return true
	},
	deleteProperty(state, prop: string) {
		// The `undefined` check is a fast path for pre-existing keys.
		if (peek(state.base_, prop) !== undefined || prop in state.base_) {
			state.assigned_[prop] = false
			prepareCopy(state)
			markChanged(state)
		} else {
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
		if (!desc) return desc
		return {
			writable: true,
			configurable: state.type_ !== ProxyTypeProxyArray || prop !== "length",
			enumerable: desc.enumerable,
			value: owner[prop]
		}
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

// Access a property without creating an Immer draft.
function peek(draft: Drafted, prop: PropertyKey) {
	const state = draft[DRAFT_STATE]
	const source = state ? latest(state) : draft
	return source[prop]
}

function readPropFromProto(state: ImmerState, source: any, prop: PropertyKey) {
	const desc = getDescriptorFromProto(source, prop)
	return desc
		? `value` in desc
			? desc.value
			: // This is a very special case, if the prop is a getter defined by the
			  // prototype, we should invoke it with the draft as context!
			  desc.get?.call(state.draft_)
		: undefined
}

function getDescriptorFromProto(
	source: any,
	prop: PropertyKey
): PropertyDescriptor | undefined {
	// 'in' checks proto!
	if (!(prop in source)) return undefined
	let proto = Object.getPrototypeOf(source)
	while (proto) {
		const desc = Object.getOwnPropertyDescriptor(proto, prop)
		if (desc) return desc
		proto = Object.getPrototypeOf(proto)
	}
	return undefined
}

export function markChanged(state: ImmerState) {
	if (!state.modified_) {
		state.modified_ = true
		if (state.parent_) {
			markChanged(state.parent_)
		}
	}
}

export function prepareCopy(state: {base_: any; copy_: any}) {
	if (!state.copy_) {
		state.copy_ = shallowCopy(state.base_)
	}
}
