// types only!
import {
	ImmerState,
	AnyMap,
	AnySet,
	MapState,
	SetState,
	DRAFT_STATE,
	getCurrentScope,
	latest,
	isDraftable,
	createProxy,
	loadPlugin,
	markChanged,
	die,
	ArchType,
	each,
	Objectish,
	isDraft
} from "../internal"

export function enableMapSet() {
	class DraftMap extends Map {
		[DRAFT_STATE]: MapState

		constructor(
			target: AnyMap,
			parent?: ImmerState
		) {
			super()
			let revoked = false
			const this_ = this
			const scope_ = parent ? parent.scope_ : getCurrentScope()!
			this[DRAFT_STATE] = new Proxy(
				(scope_.existingStateMap_?.get(target) as MapState) || {
					type_: ArchType.Map,
					parent_: parent,
					scope_: parent ? parent.scope_ : getCurrentScope()!,
					modified_: false,
					finalized_: false,
					copy_: undefined,
					assigned_: undefined,
					base_: target,
					draft_: this as any,
					isManual_: false,
					revoked_: false,
				},
				{
					get(target, p, receiver) {
						if (p === "revoked_") return revoked
						if (p === "draft_") return this_
						return Reflect.get(target, p, receiver)
					},
					set(target, p, newValue, receiver) {
						if (p === "revoked_") {
							revoked = newValue
							return true
						}
						if (p === "draft_") return false
						return Reflect.set(target, p, newValue, receiver)
					}
				}
			)

			if (parent && this[DRAFT_STATE].parent_ !== parent) {
				if (this[DRAFT_STATE].extraParents_)
					this[DRAFT_STATE].extraParents_.push(parent)
				else this[DRAFT_STATE].extraParents_ = [parent]
			}
		}

		get size(): number {
			return latest(this[DRAFT_STATE]).size
		}

		has(key: any): boolean {
			return latest(this[DRAFT_STATE]).has(key)
		}

		isValueChanging(key: any, value: any): boolean {
			const state: MapState = this[DRAFT_STATE]
			if (!latest(state).has(key)) return true

			const baseValue = latest(state).get(key)

			if (baseValue === value) return false

			if (isDraft(baseValue) && latest(baseValue[DRAFT_STATE]) === value) return false

			return true
		}

		set(key: any, value: any) {
			const state: MapState = this[DRAFT_STATE]
			const valueState: ImmerState | false = isDraft(value) && value[DRAFT_STATE]
			assertUnrevoked(state)
			if (this.isValueChanging(key, value)) {
				prepareMapCopy(state)
				markChanged(state)
				state.assigned_!.set(key, true)
				state.copy_!.set(key, value)
				state.assigned_!.set(key, true)
			}
			return this
		}

		delete(key: any): boolean {
			if (!this.has(key)) {
				return false
			}

			const state: MapState = this[DRAFT_STATE]
			assertUnrevoked(state)
			prepareMapCopy(state)
			markChanged(state)
			if (state.base_.has(key)) {
				state.assigned_!.set(key, false)
			} else {
				state.assigned_!.delete(key)
			}
			state.copy_!.delete(key)
			return true
		}

		clear() {
			const state: MapState = this[DRAFT_STATE]
			assertUnrevoked(state)
			if (latest(state).size) {
				prepareMapCopy(state)
				markChanged(state)
				state.assigned_ = new Map()
				each(state.base_, key => {
					state.assigned_!.set(key, false)
				})
				state.copy_!.clear()
			}
		}

		forEach(cb: (value: any, key: any, self: any) => void, thisArg?: any) {
			const state: MapState = this[DRAFT_STATE]
			latest(state).forEach((_value: any, key: any, _map: any) => {
				cb.call(thisArg, this.get(key), key, this)
			})
		}

		get(key: any): any {
			const state: MapState = this[DRAFT_STATE]
			assertUnrevoked(state)
			const value = latest(state).get(key)
			if (state.finalized_ || !isDraftable(value)) {
				return value
			}
			if (value !== state.base_.get(key)) {
				return value // either already drafted or reassigned
			}
			// despite what it looks, this creates a draft only once, see above condition
			const draft = createProxy(value, state)
			prepareMapCopy(state)
			state.copy_!.set(key, draft)
			return draft
		}

		keys(): IterableIterator<any> {
			return latest(this[DRAFT_STATE]).keys()
		}

		values(): IterableIterator<any> {
			const iterator = this.keys()
			return {
				[Symbol.iterator]: () => this.values(),
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

		entries(): IterableIterator<[any, any]> {
			const iterator = this.keys()
			return {
				[Symbol.iterator]: () => this.entries(),
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

		[Symbol.iterator]() {
			return this.entries()
		}
	}

	function proxyMap_<T extends AnyMap>(
		target: T,
		parent?: ImmerState
	): T {
		return new DraftMap(target, parent) as unknown as T
	}

	function prepareMapCopy(state: MapState) {
		if (state.copy_) return
		state.assigned_ = new Map()
		state.copy_ = new Map(state.base_)
		state.scope_.existingStateMap_?.set(state.base_, state)
	}

	class DraftSet extends Set {
		[DRAFT_STATE]: SetState
		constructor(
			target: AnySet,
			parent?: ImmerState
		) {
			super()
			let revoked = false
			const this_ = this
			const scope_ = parent ? parent.scope_ : getCurrentScope()!
			this[DRAFT_STATE] = new Proxy(
				(scope_.existingStateMap_?.get(target) as SetState) || {
					type_: ArchType.Set,
					parent_: parent,
					scope_,
					modified_: false,
					finalized_: false,
					copy_: undefined,
					base_: target,
					draft_: this,
					drafts_: new Map(),
					revoked_: false,
					isManual_: false
				},
				{
					get(target, p, receiver) {
						if (p === "revoked_") return revoked
						if (p === "draft_") return this_
						return Reflect.get(target, p, receiver)
					},
					set(target, p, newValue, receiver) {
						if (p === "revoked_") {
							revoked = newValue
							return true
						}
						if (p === "draft_") return false
						return Reflect.set(target, p, newValue, receiver)
					}
				}
			)

			if (parent && this[DRAFT_STATE].parent_ !== parent) {
				if (this[DRAFT_STATE].extraParents_)
					this[DRAFT_STATE].extraParents_.push(parent)
				else this[DRAFT_STATE].extraParents_ = [parent]
			}
		}

		get size(): number {
			return latest(this[DRAFT_STATE]).size
		}

		has(value: any): boolean {
			const state: SetState = this[DRAFT_STATE]
			assertUnrevoked(state)
			// bit of trickery here, to be able to recognize both the value, and the draft of its value
			if (!state.copy_) {
				return state.base_.has(value)
			}
			if (state.copy_.has(value)) return true
			if (state.drafts_.has(value) && state.copy_.has(state.drafts_.get(value)))
				return true
			return false
		}

		add(value: any): any {
			const state: SetState = this[DRAFT_STATE]
			assertUnrevoked(state)
			if (!this.has(value)) {
				prepareSetCopy(state)
				markChanged(state)
				state.copy_!.add(value)
			}
			return this
		}

		delete(value: any): any {
			if (!this.has(value)) {
				return false
			}

			const state: SetState = this[DRAFT_STATE]
			assertUnrevoked(state)
			prepareSetCopy(state)
			markChanged(state)
			return (
				state.copy_!.delete(value) ||
				(state.drafts_.has(value)
					? state.copy_!.delete(state.drafts_.get(value))
					: /* istanbul ignore next */ false)
			)
		}

		clear() {
			const state: SetState = this[DRAFT_STATE]
			assertUnrevoked(state)
			if (latest(state).size) {
				prepareSetCopy(state)
				markChanged(state)
				state.copy_!.clear()
			}
		}

		values(): IterableIterator<any> {
			const state: SetState = this[DRAFT_STATE]
			assertUnrevoked(state)
			prepareSetCopy(state)
			return state.copy_!.values()
		}

		entries(): IterableIterator<[any, any]> {
			const state: SetState = this[DRAFT_STATE]
			assertUnrevoked(state)
			prepareSetCopy(state)
			return state.copy_!.entries()
		}

		keys(): IterableIterator<any> {
			return this.values()
		}

		[Symbol.iterator]() {
			return this.values()
		}

		forEach(cb: any, thisArg?: any) {
			const iterator = this.values()
			let result = iterator.next()
			while (!result.done) {
				cb.call(thisArg, result.value, result.value, this)
				result = iterator.next()
			}
		}
	}

	function proxySet_<T extends AnySet>(
		target: T,
		parent?: ImmerState
	): T {
		return new DraftSet(target, parent) as unknown as T
	}

	function prepareSetCopy(state: SetState) {
		if (state.copy_) return
		// create drafts for all entries to preserve insertion order
		state.copy_ = new Set()
		state.scope_.existingStateMap_?.set(state.base_, state)
		state.base_.forEach(value => {
			if (isDraftable(value)) {
				const draft = createProxy(value, state)
				state.drafts_.set(value, draft)
				state.copy_!.add(draft)
			} else {
				state.copy_!.add(value)
			}
		})
	}

	function assertUnrevoked(state: any /*ES5State | MapState | SetState*/) {
		if (state.revoked_) die(3, JSON.stringify(latest(state)))
	}

	loadPlugin("MapSet", {proxyMap_, proxySet_})
}
