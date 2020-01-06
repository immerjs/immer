import {isDraftable, DRAFT_STATE, latest} from "./common"

// TODO: kill:
import {assertUnrevoked} from "./es5"
import {ImmerScope} from "./scope"
import {Immer} from "./immer"
import {AnyMap, Drafted} from "./types"

// TODO: create own states
// TODO: clean up the maps and such from ES5 / Proxy states

export interface MapState {
	type: "map"
	parent: any // TODO: type
	scope: ImmerScope
	modified: boolean
	finalizing: boolean
	finalized: boolean
	copy: AnyMap | undefined
	assigned: Map<any, boolean> | undefined
	base: AnyMap
	revoke(): void
	draft: Drafted<AnyMap, MapState>
}

function prepareCopy(state: MapState) {
	if (!state.copy) {
		state.assigned = new Map()
		state.copy = new Map(state.base)
	}
}

// Make sure DraftMap declarion doesn't die if Map is not avialable...
const MapBase: MapConstructor =
	typeof Map !== "undefined" ? Map : (function FakeMap() {} as any)

// TODO: fix types for drafts
export class DraftMap<K, V> extends MapBase implements Map<K, V> {
	[DRAFT_STATE]: MapState
	constructor(target, parent) {
		super()
		this[DRAFT_STATE] = {
			type: "map",
			parent,
			scope: parent ? parent.scope : ImmerScope.current,
			modified: false,
			finalized: false,
			finalizing: false,
			copy: undefined,
			assigned: undefined,
			base: target,
			draft: this as any, // TODO: fix typing
			revoke() {
				// TODO: make sure this marks the Map as revoked, and assert everywhere
			}
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
		if (latest(state).get(key) !== value) {
			prepareCopy(state)
			state.scope.immer.markChanged(state) // TODO: this needs to bubble up recursively correctly
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
		prepareCopy(state)
		state.scope.immer.markChanged(state)
		state.assigned!.set(key, false)
		state.copy!.delete(key)
		return true
	}

	clear() {
		const state = this[DRAFT_STATE]
		prepareCopy(state)
		state.scope.immer.markChanged(state)
		state.assigned = new Map()
		for (const key of latest(state).keys()) {
			state.assigned.set(key, false)
		}
		return state.copy!.clear()
	}

	// @ts-ignore TODO:
	forEach(cb) {
		const state = this[DRAFT_STATE]
		latest(state).forEach((_value, key, _map) => {
			cb(this.get(key), key, this)
		})
	}

	get(key: K): V /* TODO: Draft<V> */ {
		const state = this[DRAFT_STATE]
		const value = latest(state).get(key)
		if (state.finalizing || state.finalized || !isDraftable(value)) {
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

	keys() {
		return latest(this[DRAFT_STATE]).keys()
	}

	values() {
		const iterator = this.keys()
		return {
			[Symbol.iterator]: () => this.values(), // TODO: don't use symbol directly
			next: () => {
				const r = iterator.next()
				if (r.done) return r
				const value = this.get(r.value)
				return {
					done: false,
					value
				}
			}
		} as any
	}

	entries() {
		const iterator = this.keys()
		return {
			[Symbol.iterator]: () => this.entries(), // TODO: don't use symbol directly
			next: () => {
				const r = iterator.next()
				if (r.done) return r
				const value = this.get(r.value)
				return {
					done: false,
					value: [r.value, value]
				}
			}
		} as any
	}

	[Symbol.iterator]() {
		// TODO: don't use symbol directly
		return this.entries()
	}
}

export function proxyMap(target, parent) {
	return new DraftMap(target, parent)
}
