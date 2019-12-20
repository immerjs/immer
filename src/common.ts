import {Objectish, ObjectishNoSet, ImmerState} from "./types"

/** Use a class type for `nothing` so its type is unique */
export class Nothing {
	// This lets us do `Exclude<T, Nothing>`
	// TODO: do this better, use unique symbol instead
	private _: any
}

/**
 * The sentinel value returned by producers to replace the draft with undefined.
 */
export const NOTHING: Nothing =
	typeof Symbol !== "undefined"
		? Symbol("immer-nothing")
		: ({["immer-nothing"]: true} as any)

/**
 * To let Immer treat your class instances as plain immutable objects
 * (albeit with a custom prototype), you must define either an instance property
 * or a static property on each of your custom classes.
 *
 * Otherwise, your class instance will never be drafted, which means it won't be
 * safe to mutate in a produce callback.
 */
export const DRAFTABLE: unique symbol =
	typeof Symbol !== "undefined" && Symbol.for
		? Symbol.for("immer-draftable")
		: ("__$immer_draftable" as any)

export const DRAFT_STATE: unique symbol =
	typeof Symbol !== "undefined" && Symbol.for
		? Symbol.for("immer-state")
		: ("__$immer_state" as any)

/** Returns true if the given value is an Immer draft */
export function isDraft(value: any): boolean {
	return !!value && !!value[DRAFT_STATE]
}

/** Returns true if the given value can be drafted by Immer */
export function isDraftable(value: any): boolean {
	if (!value) return false
	return (
		isPlainObject(value) ||
		!!value[DRAFTABLE] ||
		!!value.constructor[DRAFTABLE] ||
		isMap(value) ||
		isSet(value)
	)
}

export function isPlainObject(value): boolean {
	if (!value || typeof value !== "object") return false
	if (Array.isArray(value)) return true
	const proto = Object.getPrototypeOf(value)
	return !proto || proto === Object.prototype
}

/** Get the underlying object that is represented by the given draft */
export function original<T>(value: T): T | undefined {
	if (value && value[DRAFT_STATE]) {
		return value[DRAFT_STATE].base
	}
	// otherwise return undefined
}

// We use Maps as `drafts` for Sets, not Objects
// See proxy.js
export function assignSet(target: Map<any, any>, override) {
	override.forEach(value => {
		// When we add new drafts we have to remove their originals if present
		const prev = original(value)
		if (prev) target.delete(prev)
		// @ts-ignore TODO investigate
		target.add(value)
	})
	return target
}

// We use Maps as `drafts` for Maps, not Objects
// See proxy.js
export function assignMap(target: Map<any, any>, override: Map<any, any>) {
	override.forEach((value, key) => target.set(key, value))
	return target
}

export const assign =
	Object.assign ||
	((target, ...overrides) => {
		overrides.forEach(override => {
			if (typeof override === "object" && override !== null)
				Object.keys(override).forEach(key => (target[key] = override[key]))
		})
		return target
	})

export const ownKeys: (target) => PropertyKey[] =
	typeof Reflect !== "undefined" && Reflect.ownKeys
		? Reflect.ownKeys
		: typeof Object.getOwnPropertySymbols !== "undefined"
		? obj =>
				Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(
					obj
				) as any)
		: Object.getOwnPropertyNames

export function shallowCopy<T extends Objectish>(
	base: T,
	invokeGetters?: boolean
): T
export function shallowCopy(base, invokeGetters = false) {
	if (Array.isArray(base)) return base.slice()
	if (isMap(base)) return new Map(base)
	if (isSet(base)) return new Set(base)
	const clone = Object.create(Object.getPrototypeOf(base))
	ownKeys(base).forEach(key => {
		if (key === DRAFT_STATE) {
			return // Never copy over draft state.
		}
		const desc = Object.getOwnPropertyDescriptor(base, key)!
		let {value} = desc
		if (desc.get) {
			if (!invokeGetters) {
				throw new Error("Immer drafts cannot have computed properties")
			}
			value = desc.get.call(base)
		}
		if (desc.enumerable) {
			clone[key] = value
		} else {
			Object.defineProperty(clone, key, {
				value,
				writable: true,
				configurable: true
			})
		}
	})
	return clone
}

export function each<T extends Objectish>(
	obj: T,
	iter: (key: PropertyKey, value: any, source: T) => void
)
export function each(obj, iter) {
	if (Array.isArray(obj) || isMap(obj) || isSet(obj)) {
		obj.forEach((entry, index) => iter(index, entry, obj))
	} else {
		ownKeys(obj).forEach(key => iter(key, obj[key], obj))
	}
}

export function isEnumerable(base: {}, prop: PropertyKey): boolean {
	const desc = Object.getOwnPropertyDescriptor(base, prop)
	return desc && desc.enumerable ? true : false
}

export function has(thing: ObjectishNoSet, prop: PropertyKey): boolean {
	return isMap(thing)
		? thing.has(prop)
		: Object.prototype.hasOwnProperty.call(thing, prop)
}

export function get(thing: ObjectishNoSet, prop: PropertyKey) {
	return isMap(thing) ? thing.get(prop) : thing[prop]
}

export function is(x, y): boolean {
	// From: https://github.com/facebook/fbjs/blob/c69904a511b900266935168223063dd8772dfc40/packages/fbjs/src/core/shallowEqual.js
	if (x === y) {
		return x !== 0 || 1 / x === 1 / y
	} else {
		return x !== x && y !== y
	}
}

export const hasSymbol = typeof Symbol !== "undefined"

export const hasMap = typeof Map !== "undefined"

export function isMap(target): target is Map<any, any> {
	return hasMap && target instanceof Map
}

export const hasSet = typeof Set !== "undefined"

export function isSet(target): target is Set<any> {
	return hasSet && target instanceof Set
}

export function makeIterable(next: () => {done: boolean; value: any}) {
	let self
	return (self = {
		[Symbol.iterator]: () => self,
		next
	})
}

/** Map.prototype.values _-or-_ Map.prototype.entries */
export function iterateMapValues(state, prop, receiver) {
	const isEntries = prop !== "values"
	return () => {
		const iterator = latest(state)[Symbol.iterator]()
		return makeIterable(() => {
			const result = iterator.next()
			if (!result.done) {
				const [key] = result.value
				const value = receiver.get(key)
				result.value = isEntries ? [key, value] : value
			}
			return result
		})
	}
}

export function makeIterateSetValues(createProxy) {
	function iterateSetValues(state, prop?) {
		const isEntries = prop === "entries"
		return () => {
			const iterator = latest(state)[Symbol.iterator]()
			return makeIterable(() => {
				const result = iterator.next()
				if (!result.done) {
					const value = wrapSetValue(state, result.value)
					result.value = isEntries ? [value, value] : value
				}
				return result
			})
		}
	}

	function wrapSetValue(state, value) {
		const key = original(value) || value
		let draft = state.drafts.get(key)
		if (!draft) {
			if (state.finalized || !isDraftable(value) || state.finalizing) {
				return value
			}
			draft = createProxy(value, state)
			state.drafts.set(key, draft)
			if (state.modified) {
				state.copy.add(draft)
			}
		}
		return draft
	}

	return iterateSetValues
}

function latest<T = any>(state: ImmerState<T>): T {
	return state.copy || state.base
}

export function clone<T extends Objectish>(obj: T): T
export function clone(obj) {
	if (!isDraftable(obj)) return obj
	if (Array.isArray(obj)) return obj.map(clone)
	if (isMap(obj)) return new Map(obj)
	if (isSet(obj)) return new Set(obj)
	const cloned = Object.create(Object.getPrototypeOf(obj))
	for (const key in obj) cloned[key] = clone(obj[key])
	return cloned
}

export function freeze<T extends Objectish>(
	obj: T,
	deep: boolean = false
): void {
	if (!isDraftable(obj) || isDraft(obj) || Object.isFrozen(obj)) return
	if (isSet(obj)) {
		obj.add = obj.clear = obj.delete = dontMutateFrozenCollections as any
	} else if (isMap(obj)) {
		obj.set = obj.clear = obj.delete = dontMutateFrozenCollections as any
	}
	Object.freeze(obj)
	if (deep) each(obj, (_, value) => freeze(value, true))
}

function dontMutateFrozenCollections() {
	throw new Error("This object has been frozen and should not be mutated")
}
