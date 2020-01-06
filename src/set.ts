import {DRAFT_STATE, latest} from "./common"

// TODO: kill:
import {ImmerScope} from "./scope"
import {AnySet, Drafted} from "./types"

// TODO: create own states
// TODO: clean up the maps and such from ES5 / Proxy states

export interface SetState {
	type: "set"
	parent: any // TODO: type
	scope: ImmerScope
	modified: boolean
	finalizing: boolean
	finalized: boolean
	copy: AnySet | undefined
	base: AnySet
	drafts: Map<any, any> // maps the original value to the draft value in the new set
	revoke(): void
	draft: Drafted<AnySet, SetState>
}

function prepareCopy(state: SetState) {
	if (!state.copy) {
		// create drafts for all entries to preserve insertion order
		state.copy = new Set()
		state.base.forEach(value => {
			const draft = state.scope.immer.createProxy(value, state)
			state.copy!.add(draft)
			state.drafts.set(value, draft)
		})
	}
}

// Make sure DraftSet declarion doesn't die if Map is not avialable...
const SetBase: SetConstructor =
	typeof Set !== "undefined" ? Set : (function FakeSet() {} as any)

// TODO: fix types for drafts
// TODO: assert unrevoked
export class DraftSet<K, V> extends SetBase implements Set<V> {
	[DRAFT_STATE]: SetState
	constructor(target, parent) {
		super()
		this[DRAFT_STATE] = {
			type: "set",
			parent,
			scope: parent ? parent.scope : ImmerScope.current,
			modified: false,
			finalized: false,
			finalizing: false,
			copy: undefined,
			base: target,
			draft: this as any, // TODO: fix typing
			drafts: new Map(),
			revoke() {
				// TODO: make sure this marks the Map as revoked, and assert everywhere
			}
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
			state.scope.immer.markChanged(state) // TODO: this needs to bubble up recursively correctly
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

	// TODO: factor out symbol
	[Symbol.iterator]() {
		return this.values()
	}

	forEach(cb, thisArg) {
		const state = this[DRAFT_STATE]
		const iterator = this.values()
		let result = iterator.next()
		while (!result.done) {
			cb.call(thisArg, result.value, result.value, state.draft)
			result = iterator.next()
		}
	}
}

export function proxySet(target, parent) {
	return new DraftSet(target, parent)
}
