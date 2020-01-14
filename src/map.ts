import {
	__extends,
	ImmerBaseState,
	ProxyType,
	AnyMap,
	Drafted,
	ImmerState,
	DRAFT_STATE,
	ImmerScope,
	latest,
	assertUnrevoked,
	isDraftable,
	iteratorSymbol
} from "./internal"

export interface MapState extends ImmerBaseState {
	type: ProxyType.Map
	copy: AnyMap | undefined
	assigned: Map<any, boolean> | undefined
	base: AnyMap
	revoked: boolean
	draft: Drafted<AnyMap, MapState>
}

const DraftMap = (function(_super) {
	if (!_super) {
		/* istanbul ignore next */
		throw new Error("Map is not polyfilled")
	}
	__extends(DraftMap, _super)
	// Create class manually, cause #502
	function DraftMap(this: any, target: AnyMap, parent?: ImmerState): any {
		this[DRAFT_STATE] = {
			type: ProxyType.Map,
			parent,
			scope: parent ? parent.scope : ImmerScope.current!,
			modified: false,
			finalized: false,
			copy: undefined,
			assigned: undefined,
			base: target,
			draft: this as any,
			isManual: false,
			revoked: false
		}
		return this
	}
	const p = DraftMap.prototype

	// TODO: smaller build size if we create a util for Object.defineProperty
	Object.defineProperty(p, "size", {
		get: function() {
			return latest(this[DRAFT_STATE]).size
		},
		enumerable: true,
		configurable: true
	})

	p.has = function(key: any): boolean {
		return latest(this[DRAFT_STATE]).has(key)
	}

	p.set = function(key: any, value: any) {
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

	p.delete = function(key: any): boolean {
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

	p.clear = function() {
		const state = this[DRAFT_STATE]
		assertUnrevoked(state)
		prepareCopy(state)
		state.scope.immer.markChanged(state)
		state.assigned = new Map()
		return state.copy!.clear()
	}

	p.forEach = function(
		cb: (value: any, key: any, self: any) => void,
		thisArg?: any
	) {
		const state = this[DRAFT_STATE]
		latest(state).forEach((_value: any, key: any, _map: any) => {
			cb.call(thisArg, this.get(key), key, this)
		})
	}

	p.get = function(key: any): any {
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

	p.keys = function(): IterableIterator<any> {
		return latest(this[DRAFT_STATE]).keys()
	}

	p.values = function(): IterableIterator<any> {
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

	p.entries = function(): IterableIterator<[any, any]> {
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

	p[iteratorSymbol] = function() {
		return this.entries()
	}

	return DraftMap
})(Map)

export function proxyMap<T extends AnyMap>(
	target: T,
	parent?: ImmerState
): T & {[DRAFT_STATE]: MapState} {
	// @ts-ignore
	return new DraftMap(target, parent)
}

function prepareCopy(state: MapState) {
	if (!state.copy) {
		state.assigned = new Map()
		state.copy = new Map(state.base)
	}
}
