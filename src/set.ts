import {
	__extends,
	ImmerBaseState,
	ProxyType,
	AnySet,
	Drafted,
	ImmerState,
	DRAFT_STATE,
	ImmerScope,
	latest,
	assertUnrevoked,
	iteratorSymbol,
	isDraftable
} from "./internal"

export interface SetState extends ImmerBaseState {
	type: ProxyType.Set
	copy: AnySet | undefined
	base: AnySet
	drafts: Map<any, Drafted> // maps the original value to the draft value in the new set
	revoked: boolean
	draft: Drafted<AnySet, SetState>
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
			prepareCopy(state)
			state.scope.immer.markChanged(state)
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
		prepareCopy(state)
		state.scope.immer.markChanged(state)
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
		prepareCopy(state)
		state.scope.immer.markChanged(state)
		return state.copy!.clear()
	}

	p.values = function(): IterableIterator<any> {
		const state = this[DRAFT_STATE]
		assertUnrevoked(state)
		prepareCopy(state)
		return state.copy!.values()
	}

	p.entries = function entries(): IterableIterator<[any, any]> {
		const state = this[DRAFT_STATE]
		assertUnrevoked(state)
		prepareCopy(state)
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

export function proxySet<T extends AnySet>(
	target: T,
	parent?: ImmerState
): T & {[DRAFT_STATE]: SetState} {
	// @ts-ignore
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
