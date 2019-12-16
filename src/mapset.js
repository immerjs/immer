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
	iterateMapValues,
	makeIterable,
	makeIterateSetValues
} from "./common"

// TODO: kill:
import {
	createProxy,
	assertUnrevoked,
	latest,
	prepareCopy,
	markChanged
} from "./es5"

export function proxyMap(target) {
	Object.defineProperties(target, mapTraps)

	if (hasSymbol) {
		Object.defineProperty(
			target,
			Symbol.iterator,
			proxyMethod(iterateMapValues)
		)
	}
}

const mapTraps = finalizeTraps({
	size: state => latest(state).size,
	has: state => key => latest(state).has(key),
	set: state => (key, value) => {
		if (latest(state).get(key) !== value) {
			prepareCopy(state)
			markChanged(state)
			state.assigned.set(key, true)
			state.copy.set(key, value)
		}
		return state.draft
	},
	delete: state => key => {
		prepareCopy(state)
		markChanged(state)
		state.assigned.set(key, false)
		state.copy.delete(key)
		return false
	},
	clear: state => () => {
		if (!state.copy) {
			prepareCopy(state)
		}
		markChanged(state)
		state.assigned = new Map()
		for (const key of latest(state).keys()) {
			state.assigned.set(key, false)
		}
		return state.copy.clear()
	},
	forEach: (state, key, reciever) => cb => {
		latest(state).forEach((value, key, map) => {
			cb(reciever.get(key), key, map)
		})
	},
	get: state => key => {
		const value = latest(state).get(key)

		if (state.finalizing || state.finalized || !isDraftable(value)) {
			return value
		}

		if (value !== state.base.get(key)) {
			return value
		}
		const draft = createProxy(value, state)
		prepareCopy(state)
		state.copy.set(key, draft)
		return draft
	},
	keys: state => () => latest(state).keys(),
	values: iterateMapValues,
	entries: iterateMapValues
})

export function proxySet(target) {
	Object.defineProperties(target, setTraps)

	if (hasSymbol) {
		Object.defineProperty(
			target,
			Symbol.iterator,
			proxyMethod(iterateSetValues)
		)
	}
}

const iterateSetValues = makeIterateSetValues(createProxy)

const setTraps = finalizeTraps({
	size: state => {
		return latest(state).size
	},
	add: state => value => {
		if (!latest(state).has(value)) {
			markChanged(state)
			if (!state.copy) {
				prepareCopy(state)
			}
			state.copy.add(value)
		}
		return state.draft
	},
	delete: state => value => {
		markChanged(state)
		if (!state.copy) {
			prepareCopy(state)
		}
		return state.copy.delete(value)
	},
	has: state => key => {
		return latest(state).has(key)
	},
	clear: state => () => {
		markChanged(state)
		if (!state.copy) {
			prepareCopy(state)
		}
		return state.copy.clear()
	},
	keys: iterateSetValues,
	entries: iterateSetValues,
	values: iterateSetValues,
	forEach: state => (cb, thisArg) => {
		const iterator = iterateSetValues(state)()
		let result = iterator.next()
		while (!result.done) {
			cb.call(thisArg, result.value, result.value, state.draft)
			result = iterator.next()
		}
	}
})

function finalizeTraps(traps) {
	return Object.keys(traps).reduce(function(acc, key) {
		const builder = key === "size" ? proxyAttr : proxyMethod
		acc[key] = builder(traps[key], key)
		return acc
	}, {})
}

function proxyAttr(fn) {
	return {
		get() {
			const state = this[DRAFT_STATE]
			assertUnrevoked(state)
			return fn(state)
		}
	}
}

function proxyMethod(trap, key) {
	return {
		get() {
			return function(...args) {
				const state = this[DRAFT_STATE]
				assertUnrevoked(state)
				return trap(state, key, state.draft)(...args)
			}
		}
	}
}

export function hasMapChanges(state) {
	const {base, draft} = state

	if (base.size !== draft.size) return true

	// IE11 supports only forEach iteration
	let hasChanges = false
	draft.forEach(function(value, key) {
		if (!hasChanges) {
			hasChanges = isDraftable(value) ? value.modified : value !== base.get(key)
		}
	})
	return hasChanges
}

export function hasSetChanges(state) {
	const {base, draft} = state

	if (base.size !== draft.size) return true

	// IE11 supports only forEach iteration
	let hasChanges = false
	draft.forEach(function(value, key) {
		if (!hasChanges) {
			hasChanges = isDraftable(value) ? value.modified : !base.has(key)
		}
	})
	return hasChanges
}
