import {isDraftable, DRAFT_STATE, latest, iteratorSymbol} from "./common"

import {ImmerScope} from "./scope"
import {AnyMap, Drafted, ImmerState, ImmerBaseState, ProxyType} from "./types"
import {assertUnrevoked} from "./es5"

export interface MapState extends ImmerBaseState {
	type: ProxyType.Map
	copy: AnyMap | undefined
	assigned: Map<any, boolean> | undefined
	base: AnyMap
	revoked: boolean
	draft: Drafted<AnyMap, MapState>
}

// Make sure DraftMap declarion doesn't die if Map is not avialable...
/* istanbul ignore next */
const MapBase: MapConstructor =
	typeof Map !== "undefined" ? Map : (function FakeMap() {} as any)

export class DraftMap<K, V> extends MapBase implements Map<K, V> {
	[DRAFT_STATE]: MapState
	constructor(target: AnyMap, parent?: ImmerState) {
		super()
		this[DRAFT_STATE] = {
			type: ProxyType.Map,
			parent,
			scope: parent ? parent.scope : ImmerScope.current!,
			modified: false,
			finalized: false,
			copy: undefined,
			assigned: undefined,
			base: target,
			draft: this,
			isManual: false,
			revoked: false
		}
	}

	get size(): number {
		return latest(this[DRAFT_STATE]).size
	}

	has(key: K): boolean {
		return latest(this[DRAFT_STATE]).has(key)
	}

	set(key: K, value: V): this {
		const state = this[DRAFT_STATE]
		assertUnrevoked(state)
		if (latest(state).get(key) !== value) {
			prepareCopy(state)
			state.scope.immer.markChanged(state)
			state.assigned!.set(key, true)
			state.copy!.set(key, value)
			state.assigned!.set(key, true)
		}
		return this
	}

	delete(key: K): boolean {
		if (!this.has(key)) {
			return false
		}

		const state = this[DRAFT_STATE]
		assertUnrevoked(state)
		prepareCopy(state)
		state.scope.immer.markChanged(state)
		state.assigned!.set(key, false)
		state.copy!.delete(key)
		return true
	}

	clear() {
		const state = this[DRAFT_STATE]
		assertUnrevoked(state)
		prepareCopy(state)
		state.scope.immer.markChanged(state)
		state.assigned = new Map()
		for (const key of latest(state).keys()) {
			state.assigned.set(key, false)
		}
		return state.copy!.clear()
	}

	forEach(cb: (value: V, key: K, self: this) => void, thisArg?: any) {
		const state = this[DRAFT_STATE]
		latest(state).forEach((_value: V, key: K, _map: this) => {
			cb.call(thisArg, this.get(key), key, this)
		})
	}

	get(key: K): V {
		const state = this[DRAFT_STATE]
		assertUnrevoked(state)
		const value = latest(state).get(key)
		if (state.finalized || !isDraftable(value)) {
			return value
		}
		if (value !== state.base.get(key)) {
			return value // either already drafted or reassigned
		}
		// despite what it looks, this creates a draft only once, see above condition
		const draft = state.scope.immer.createProxy(value, state)
		prepareCopy(state)
		state.copy!.set(key, draft)
		return draft
	}

	keys(): IterableIterator<K> {
		return latest(this[DRAFT_STATE]).keys()
	}

	values(): IterableIterator<V> {
		const iterator = this.keys()
		return {
			[iteratorSymbol]: () => this.values(),
			next: () => {
				const r = iterator.next()
				/* istanbul ignore next */
				if (r.done) return r
				const value = this.get(r.value)
				return {
					done: false,
					value
				}
			}
		} as any
	}

	entries(): IterableIterator<[K, V]> {
		const iterator = this.keys()
		return {
			[iteratorSymbol]: () => this.entries(),
			next: () => {
				const r = iterator.next()
				/* istanbul ignore next */
				if (r.done) return r
				const value = this.get(r.value)
				return {
					done: false,
					value: [r.value, value]
				}
			}
		} as any
	}

	[iteratorSymbol]() {
		return this.entries()
	}
}

export function proxyMap(target: AnyMap, parent?: ImmerState) {
	return new DraftMap(target, parent)
}

function prepareCopy(state: MapState) {
	if (!state.copy) {
		state.assigned = new Map()
		state.copy = new Map(state.base)
	}
}
