import {
	each,
	ImmerState,
	Drafted,
	Objectish,
	getCurrentScope,
	die,
	ProxyTypeProxyObject,
	ProxyTypeProxyArray
} from "../internal"
import {objectTraps} from "./proxyObjectTraps"
import {
	ProxyState,
	ProxyArrayState,
	withoutActualValueSymbolThisFileIsGoneInTypesDonooWhy
} from "./proxyStateTypes"

withoutActualValueSymbolThisFileIsGoneInTypesDonooWhy.toString()

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
