import {
	die,
	isDraft,
	shallowCopy,
	each,
	DRAFT_STATE,
	set,
	ImmerState,
	isDraftable,
	isFrozen
} from "../internal"

/** Takes a snapshot of the current state of a draft and finalizes it (but without freezing). This is a great utility to print the current state during debugging (no Proxies in the way). The output of current can also be safely leaked outside the producer. */
export function current<T>(value: T): T
export function current(value: any): any {
	if (!isDraft(value)) die(10, value)
	return currentImpl(value)
}

function currentImpl(value: any): any {
	if (!isDraftable(value) || isFrozen(value)) return value
	const state: ImmerState | undefined = value[DRAFT_STATE]
	let copy: any
	let strict = true // we might not know, so true just to be safe
	if (state) {
		if (!state.modified_) return state.base_
		// Optimization: avoid generating new drafts during copying
		state.finalized_ = true
		strict = state.scope_.immer_.useStrict_(value)
	}
	copy = shallowCopy(value, strict)
	// recurse
	each(
		copy,
		(key, childValue) => {
			set(copy, key, currentImpl(childValue))
		},
		strict
	)
	if (state) {
		state.finalized_ = false
	}
	return copy
}
