import {
	DRAFT_STATE,
	DRAFTABLE,
	hasSet,
	Objectish,
	Drafted,
	AnyObject,
	AnyArray,
	AnyMap,
	AnySet,
	ImmerState,
	hasMap,
	ArchtypeObject,
	ArchtypeArray,
	ArchtypeMap,
	ArchtypeSet,
	die
} from "../internal"

/** Returns true if the given value is an Immer draft */
/*#__PURE__*/
export function isDraft(value: any): boolean {
	return !!value && !!value[DRAFT_STATE]
}

/** Returns true if the given value can be drafted by Immer */
/*#__PURE__*/
export function isDraftable(value: any): boolean {
	if (!value) return false
	return (
		isPlainObject(value) ||
		Array.isArray(value) ||
		!!value[DRAFTABLE] ||
		!!value.constructor[DRAFTABLE] ||
		isMap(value) ||
		isSet(value)
	)
}

/*#__PURE__*/
export function isPlainObject(value: any): boolean {
	if (!value || typeof value !== "object") return false
	const proto = Object.getPrototypeOf(value)
	return !proto || proto === Object.prototype
}

/** Get the underlying object that is represented by the given draft */
/*#__PURE__*/
export function original<T>(value: T): T | undefined
export function original(value: Drafted<any>): any {
	if (value && value[DRAFT_STATE]) {
		return value[DRAFT_STATE].base_ as any
	}
	// otherwise return undefined
}

/*#__PURE__*/
export const ownKeys: (target: AnyObject) => PropertyKey[] =
	typeof Reflect !== "undefined" && Reflect.ownKeys
		? Reflect.ownKeys
		: typeof Object.getOwnPropertySymbols !== "undefined"
		? obj =>
				Object.getOwnPropertyNames(obj).concat(
					Object.getOwnPropertySymbols(obj) as any
				)
		: /* istanbul ignore next */ Object.getOwnPropertyNames

export function each<T extends Objectish>(
	obj: T,
	iter: (key: string | number, value: any, source: T) => void
): void
export function each(obj: any, iter: any) {
	if (getArchtype(obj) === ArchtypeObject) {
		ownKeys(obj).forEach(key => iter(key, obj[key], obj))
	} else {
		obj.forEach((entry: any, index: any) => iter(index, entry, obj))
	}
}

/*#__PURE__*/
export function getArchtype(thing: any): 0 | 1 | 2 | 3 {
	/* istanbul ignore next */
	const state: undefined | ImmerState = thing[DRAFT_STATE]
	return state
		? state.type_ > 3
			? state.type_ - 4 // cause Object and Array map back from 4 and 5
			: (state.type_ as any) // others are the same
		: Array.isArray(thing)
		? ArchtypeArray
		: isMap(thing)
		? ArchtypeMap
		: isSet(thing)
		? ArchtypeSet
		: ArchtypeObject
}

/*#__PURE__*/
export function has(thing: any, prop: PropertyKey): boolean {
	return getArchtype(thing) === ArchtypeMap
		? thing.has(prop)
		: Object.prototype.hasOwnProperty.call(thing, prop)
}

/*#__PURE__*/
export function get(thing: AnyMap | AnyObject, prop: PropertyKey): any {
	// @ts-ignore
	return getArchtype(thing) === ArchtypeMap ? thing.get(prop) : thing[prop]
}

/*#__PURE__*/
export function set(thing: any, propOrOldValue: PropertyKey, value: any) {
	const t = getArchtype(thing)
	if (t === ArchtypeMap) thing.set(propOrOldValue, value)
	else if (t === ArchtypeSet) {
		thing.delete(propOrOldValue)
		thing.add(value)
	} else thing[propOrOldValue] = value
}

/*#__PURE__*/
export function is(x: any, y: any): boolean {
	// From: https://github.com/facebook/fbjs/blob/c69904a511b900266935168223063dd8772dfc40/packages/fbjs/src/core/shallowEqual.js
	if (x === y) {
		return x !== 0 || 1 / x === 1 / y
	} else {
		return x !== x && y !== y
	}
}

/*#__PURE__*/
export function isMap(target: any): target is AnyMap {
	return hasMap && target instanceof Map
}

/*#__PURE__*/
export function isSet(target: any): target is AnySet {
	return hasSet && target instanceof Set
}
/*#__PURE__*/
export function latest(state: ImmerState): any {
	return state.copy_ || state.base_
}

/*#__PURE__*/
export function shallowCopy<T extends AnyObject | AnyArray>(
	base: T,
	invokeGetters?: boolean
): T
export function shallowCopy(base: any, invokeGetters = false) {
	if (Array.isArray(base)) return base.slice()
	const clone = Object.create(Object.getPrototypeOf(base))
	each(base, (key: any) => {
		if (key === DRAFT_STATE) {
			return // Never copy over draft state.
		}
		const desc = Object.getOwnPropertyDescriptor(base, key)!
		let {value} = desc
		if (desc.get) {
			if (!invokeGetters) die(1)
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

export function freeze(obj: any, deep: boolean): void {
	if (isDraft(obj) || Object.isFrozen(obj) || !isDraftable(obj)) return
	if (getArchtype(obj) > 1 /* Map or Set */) {
		obj.set = obj.add = obj.clear = obj.delete = dontMutateFrozenCollections as any
	}
	Object.freeze(obj)
	if (deep) each(obj, (_, value) => freeze(value, true))
}

function dontMutateFrozenCollections() {
	die(2)
}
