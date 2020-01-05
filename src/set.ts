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
	makeIterable,
	latest,
	original,
	makeIterable2
} from "./common"

// TODO: kill:
import {
	assertUnrevoked,
	ES5Draft,
} from "./es5"
import { ImmerScope } from "./scope";
import { Immer } from "./immer";

// TODO: create own states
// TODO: clean up the maps and such from ES5 / Proxy states

export interface SetState {
	parent: any; // TODO: type
	scope: ImmerScope;
	modified: boolean;
	finalizing: boolean;
	finalized: boolean;
	copy: Set<any> | undefined;
	// assigned: Map<any, boolean> | undefined;
	base: Set<any>;
	revoke(): void;
	draft: ES5Draft;
}

function prepareCopy(state: SetState) {
	if (!state.copy) {
			// create drafts for all entries to preserve insertion order
				state.copy = new Set()
				state.base.forEach(value => {
					state.copy!.add(state.scope.immer.createProxy(value, state))
				})
	}
}

// Make sure DraftSet declarion doesn't die if Map is not avialable...
const SetBase: SetConstructor = typeof Set !== "undefined" ? Set : function FakeSet() {} as any

// TODO: fix types for drafts
export class DraftSet<K, V> extends SetBase implements Set<V> {
	[DRAFT_STATE]: SetState
	constructor(target, parent) {
		super()
		this[DRAFT_STATE] = {
			parent,
			scope: parent ? parent.scope : ImmerScope.current,
			modified: false,
			finalized: false,
			finalizing: false,
			copy: undefined,
			base: target,
			draft: this as any, // TODO: fix typing
			revoke() {
				// TODO: make sure this marks the Map as revoked, and assert everywhere
			}
		};
	}

	get size(): number {
		return latest(this[DRAFT_STATE]).size
	}

	has(value: V): boolean {
		return latest(this[DRAFT_STATE]).has(value)
	}

	add(value: V): this {
		const state = this[DRAFT_STATE];
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
		if (!this.has(value)) {
			return false;
		}

		const state = this[DRAFT_STATE];
		prepareCopy(state)
		state.scope.immer.markChanged(state)
		return state.copy!.delete(value)
	}

	clear() {
		const state = this[DRAFT_STATE];
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
	if (target instanceof DraftSet) {
		return target; // TODO: or copy?
	}
	return new DraftSet(target, parent)
}

// const iterateSetValues = makeIterateSetValues()



export function hasSetChanges(state) {
	const {base, draft} = state

	if (base.size !== draft.size) return true

	// IE11 supports only forEach iteration
	let hasChanges = false
	// TODO: optimize: break on first diff
	draft.forEach(function(value, key) {
		if (!hasChanges) {
			hasChanges = isDraftable(value) ? value.modified : !base.has(key)
		}
	})
	return hasChanges
}
