import {
	die,
	isDraft,
	shallowCopy,
	each,
	DRAFT_STATE,
	get,
	set,
	ImmerState,
	isDraftable
} from "../internal"

export function current<T>(value: T): T
export function current(value: any): any {
	if (!isDraft(value)) die(22, value)
	return currentImpl(value)
}

function currentImpl(value: any): any {
	if (!isDraftable(value)) return value
	const state: ImmerState | undefined = value[DRAFT_STATE]
	let copy: any
	if (state) {
		if (!state.modified_) return state.base_
		// Optimization: avoid generating new drafts during copying
		state.finalized_ = true
		copy = shallowCopy(value)
		state.finalized_ = false
	} else {
		copy = shallowCopy(value)
	}

	each(copy, (key, childValue) => {
		if (state && get(state.base_, key) === childValue) return // no need to copy a current of something that didn't change
		set(copy, key, currentImpl(childValue))
	})
	return copy
}
