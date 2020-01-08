import {DRAFT_STATE, latest, isDraftable, iteratorSymbol} from "./common"

import {ImmerScope} from "./scope"
import {AnySet, Drafted, ImmerState, ImmerBaseState} from "./types"

export interface SetState extends ImmerBaseState {
	type: "set"
	finalizing: boolean
	copy: AnySet | undefined
	base: AnySet
	drafts: Map<any, Drafted> // maps the original value to the draft value in the new set
	revoke(): void
	draft: Drafted<AnySet, SetState>
}

// Make sure DraftSet declarion doesn't die if Map is not avialable...
const SetBase: SetConstructor =
	typeof Set !== "undefined" ? Set : (function FakeSet() {} as any)

export class DraftSet<K, V> extends SetBase implements Set<V> {
	[DRAFT_STATE]: SetState
	constructor(target: AnySet, parent?: ImmerState) {
		super()
		this[DRAFT_STATE] = {
			type: "set",
			parent,
			scope: parent ? parent.scope : ImmerScope.current!,
			modified: false,
			finalized: false,
			finalizing: false,
			copy: undefined,
			base: target,
			draft: this,
			drafts: new Map(),
			revoke() {
				// TODO: make sure this marks the Map as revoked, and assert everywhere
			},
			isManual: false
		}
	}

	get size(): number {
		return latest(this[DRAFT_STATE]).size
	}

	has(value: V): boolean {
		const state = this[DRAFT_STATE]
		// bit of trickery here, to be able to recognize both the value, and the draft of its value
		if (!state.copy) {
			return state.base.has(value)
		}
		if (state.copy.has(value)) return true
		if (state.drafts.has(value) && state.copy.has(state.drafts.get(value)))
			return true
		return false
	}

	add(value: V): this {
		const state = this[DRAFT_STATE]
		if (state.copy) {
			state.copy.add(value)
		} else if (!state.base.has(value)) {
			prepareCopy(state)
			state.scope.immer.markChanged(state)
			state.copy!.add(value)
		}
		return this
	}

	delete(value: V): boolean {
		const state = this[DRAFT_STATE]
		if (!this.has(value)) {
			return false
		}

		prepareCopy(state)
		state.scope.immer.markChanged(state)
		return (
			state.copy!.delete(value) ||
			(state.drafts.has(value)
				? state.copy!.delete(state.drafts.get(value))
				: false)
		)
	}

	clear() {
		const state = this[DRAFT_STATE]
		prepareCopy(state)
		state.scope.immer.markChanged(state)
		return state.copy!.clear()
	}

	values(): IterableIterator<V> {
		const state = this[DRAFT_STATE]
		prepareCopy(state)
		return state.copy!.values()
	}

	entries(): IterableIterator<[V, V]> {
		const state = this[DRAFT_STATE]
		prepareCopy(state)
		return state.copy!.entries()
	}

	keys(): IterableIterator<V> {
		return this.values()
	}

	[iteratorSymbol]() {
		return this.values()
	}

	forEach(cb: (value: V, key: V, self: this) => void, thisArg?: any) {
		const state = this[DRAFT_STATE]
		const iterator = this.values()
		let result = iterator.next()
		while (!result.done) {
			cb.call(thisArg, result.value, result.value, this)
			result = iterator.next()
		}
	}
}

export function proxySet(target: AnySet, parent?: ImmerState) {
	return new DraftSet(target, parent)
}

function prepareCopy(state: SetState) {
	if (!state.copy) {
		// create drafts for all entries to preserve insertion order
		state.copy = new Set()
		state.base.forEach(value => {
			if (isDraftable(value)) {
				const draft = state.scope.immer.createProxy(value, state)
				state.drafts.set(value, draft)
				state.copy!.add(draft)
			} else {
				state.copy!.add(value)
			}
		})
	}
}
