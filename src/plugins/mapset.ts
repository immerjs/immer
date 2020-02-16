// types only!
import {
	ImmerState,
	AnyMap,
	AnySet,
	MapState,
	SetState,
	DRAFT_STATE,
	ProxyType,
	ImmerScope,
	latest,
	assertUnrevoked,
	iteratorSymbol,
	isDraftable,
	createProxy,
	loadPlugin,
	markChanged
} from "../internal"

export function enableMapSet() {
	/* istanbul ignore next */
	var extendStatics = function(d: any, b: any): any {
		extendStatics =
			Object.setPrototypeOf ||
			({__proto__: []} instanceof Array &&
				function(d, b) {
					d.__proto__ = b
				}) ||
			function(d, b) {
				for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]
			}
		return extendStatics(d, b)
	}

	// Ugly hack to resolve #502 and inherit built in Map / Set
	function __extends(d: any, b: any): any {
		extendStatics(d, b)
		function __(this: any): any {
			this.constructor = d
		}
		d.prototype =
			// @ts-ignore
			((__.prototype = b.prototype), new __())
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
				prepareMapCopy(state)
				markChanged(state.scope.immer, state)
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
			prepareMapCopy(state)
			markChanged(state.scope.immer, state)
			state.assigned!.set(key, false)
			state.copy!.delete(key)
			return true
		}

		p.clear = function() {
			const state = this[DRAFT_STATE]
			assertUnrevoked(state)
			prepareMapCopy(state)
			markChanged(state.scope.immer, state)
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
			const draft = createProxy(state.scope.immer, value, state)
			prepareMapCopy(state)
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

	function proxyMap<T extends AnyMap>(target: T, parent?: ImmerState): T {
		// @ts-ignore
		return new DraftMap(target, parent)
	}

	function prepareMapCopy(state: MapState) {
		if (!state.copy) {
			state.assigned = new Map()
			state.copy = new Map(state.base)
		}
	}

	const DraftSet = (function(_super) {
		if (!_super) {
			/* istanbul ignore next */
			throw new Error("Set is not polyfilled")
		}
		__extends(DraftSet, _super)
		// Create class manually, cause #502
		function DraftSet(this: any, target: AnySet, parent?: ImmerState) {
			this[DRAFT_STATE] = {
				type: ProxyType.Set,
				parent,
				scope: parent ? parent.scope : ImmerScope.current!,
				modified: false,
				finalized: false,
				copy: undefined,
				base: target,
				draft: this,
				drafts: new Map(),
				revoked: false,
				isManual: false
			}
			return this
		}
		const p = DraftSet.prototype

		Object.defineProperty(p, "size", {
			get: function() {
				return latest(this[DRAFT_STATE]).size
			},
			enumerable: true,
			configurable: true
		})

		p.has = function(value: any): boolean {
			const state = this[DRAFT_STATE]
			assertUnrevoked(state)
			// bit of trickery here, to be able to recognize both the value, and the draft of its value
			if (!state.copy) {
				return state.base.has(value)
			}
			if (state.copy.has(value)) return true
			if (state.drafts.has(value) && state.copy.has(state.drafts.get(value)))
				return true
			return false
		}

		p.add = function(value: any): any {
			const state = this[DRAFT_STATE]
			assertUnrevoked(state)
			if (state.copy) {
				state.copy.add(value)
			} else if (!state.base.has(value)) {
				prepareSetCopy(state)
				markChanged(state.scope.immer, state)
				state.copy!.add(value)
			}
			return this
		}

		p.delete = function(value: any): any {
			if (!this.has(value)) {
				return false
			}

			const state = this[DRAFT_STATE]
			assertUnrevoked(state)
			prepareSetCopy(state)
			markChanged(state.scope.immer, state)
			return (
				state.copy!.delete(value) ||
				(state.drafts.has(value)
					? state.copy!.delete(state.drafts.get(value))
					: /* istanbul ignore next */ false)
			)
		}

		p.clear = function() {
			const state = this[DRAFT_STATE]
			assertUnrevoked(state)
			prepareSetCopy(state)
			markChanged(state.scope.immer, state)
			return state.copy!.clear()
		}

		p.values = function(): IterableIterator<any> {
			const state = this[DRAFT_STATE]
			assertUnrevoked(state)
			prepareSetCopy(state)
			return state.copy!.values()
		}

		p.entries = function entries(): IterableIterator<[any, any]> {
			const state = this[DRAFT_STATE]
			assertUnrevoked(state)
			prepareSetCopy(state)
			return state.copy!.entries()
		}

		p.keys = function(): IterableIterator<any> {
			return this.values()
		}

		p[iteratorSymbol] = function() {
			return this.values()
		}

		p.forEach = function forEach(cb: any, thisArg?: any) {
			const iterator = this.values()
			let result = iterator.next()
			while (!result.done) {
				cb.call(thisArg, result.value, result.value, this)
				result = iterator.next()
			}
		}

		return DraftSet
	})(Set)

	function proxySet<T extends AnySet>(target: T, parent?: ImmerState): T {
		// @ts-ignore
		return new DraftSet(target, parent)
	}

	function prepareSetCopy(state: SetState) {
		if (!state.copy) {
			// create drafts for all entries to preserve insertion order
			state.copy = new Set()
			state.base.forEach(value => {
				if (isDraftable(value)) {
					const draft = createProxy(state.scope.immer, value, state)
					state.drafts.set(value, draft)
					state.copy!.add(draft)
				} else {
					state.copy!.add(value)
				}
			})
		}
	}

	loadPlugin("mapset", {proxyMap, proxySet})
}
