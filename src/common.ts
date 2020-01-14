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
	ProxyType,
	Archtype,
	hasMap
} from "./internal"

/** Returns true if the given value is an Immer draft */
export function isDraft(value: any): boolean {
	return !!value && !!value[DRAFT_STATE]
}

/** Returns true if the given value can be drafted by Immer */
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

export function isPlainObject(value: any): boolean {
	if (!value || typeof value !== "object") return false
	const proto = Object.getPrototypeOf(value)
	return !proto || proto === Object.prototype
}

/** Get the underlying object that is represented by the given draft */
export function original<T>(value: T): T | undefined
export function original(value: Drafted<any>): any {
	if (value && value[DRAFT_STATE]) {
		return value[DRAFT_STATE].base as any
	}
	// otherwise return undefined
}

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
	if (getArchtype(obj) === Archtype.Object) {
		ownKeys(obj).forEach(key => iter(key, obj[key], obj))
	} else {
		obj.forEach((entry: any, index: any) => iter(index, entry, obj))
	}
}

export function isEnumerable(base: AnyObject, prop: PropertyKey): boolean {
	const desc = Object.getOwnPropertyDescriptor(base, prop)
	return desc && desc.enumerable ? true : false
}

export function getArchtype(thing: any): Archtype {
	/* istanbul ignore next */
	if (!thing) die()
	if (thing[DRAFT_STATE]) {
		switch ((thing as Drafted)[DRAFT_STATE].type) {
			case ProxyType.ES5Object:
			case ProxyType.ProxyObject:
				return Archtype.Object
			case ProxyType.ES5Array:
			case ProxyType.ProxyArray:
				return Archtype.Array
			case ProxyType.Map:
				return Archtype.Map
			case ProxyType.Set:
				return Archtype.Set
		}
	}
	return Array.isArray(thing)
		? Archtype.Array
		: isMap(thing)
		? Archtype.Map
		: isSet(thing)
		? Archtype.Set
		: Archtype.Object
}

export function has(thing: any, prop: PropertyKey): boolean {
	return getArchtype(thing) === Archtype.Map
		? thing.has(prop)
		: Object.prototype.hasOwnProperty.call(thing, prop)
}

export function get(thing: AnyMap | AnyObject, prop: PropertyKey): any {
	// @ts-ignore
	return getArchtype(thing) === Archtype.Map ? thing.get(prop) : thing[prop]
}

export function set(thing: any, propOrOldValue: PropertyKey, value: any) {
	switch (getArchtype(thing)) {
		case Archtype.Map:
			thing.set(propOrOldValue, value)
			break
		case Archtype.Set:
			thing.delete(propOrOldValue)
			thing.add(value)
			break
		default:
			thing[propOrOldValue] = value
	}
}

export function is(x: any, y: any): boolean {
	// From: https://github.com/facebook/fbjs/blob/c69904a511b900266935168223063dd8772dfc40/packages/fbjs/src/core/shallowEqual.js
	if (x === y) {
		return x !== 0 || 1 / x === 1 / y
	} else {
		return x !== x && y !== y
	}
}

export function isMap(target: any): target is AnyMap {
	return hasMap && target instanceof Map
}

export function isSet(target: any): target is AnySet {
	return hasSet && target instanceof Set
}

export function latest(state: ImmerState): any {
	return state.copy || state.base
}

export function shallowCopy<T extends AnyObject | AnyArray>(
	base: T,
	invokeGetters?: boolean
): T
export function shallowCopy(base: any, invokeGetters = false) {
	if (Array.isArray(base)) return base.slice()
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

export function freeze(obj: any, deep: boolean): void {
	if (!isDraftable(obj) || isDraft(obj) || Object.isFrozen(obj)) return
	const type = getArchtype(obj)
	if (type === Archtype.Set) {
		obj.add = obj.clear = obj.delete = dontMutateFrozenCollections as any
	} else if (type === Archtype.Map) {
		obj.set = obj.clear = obj.delete = dontMutateFrozenCollections as any
	}
	Object.freeze(obj)
	if (deep) each(obj, (_, value) => freeze(value, true))
}

function dontMutateFrozenCollections() {
	throw new Error("This object has been frozen and should not be mutated")
}

export function createHiddenProperty(
	target: AnyObject,
	prop: PropertyKey,
	value: any
) {
	Object.defineProperty(target, prop, {
		value: value,
		enumerable: false,
		writable: true
	})
}

/* istanbul ignore next */
export function die(): never {
	throw new Error("Illegal state, please file a bug")
}
