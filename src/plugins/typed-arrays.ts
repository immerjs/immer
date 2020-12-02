import {
	DRAFT_STATE,
	loadPlugin,
	TypedArrayState,
	ImmerState,
	getCurrentScope,
	die,
	latest,
	ProxyTypeTypedArray,
	markChanged,
	AnyTypedArray,
	Drafted
} from "../internal"

export function enableTypedArrays() {
	/**
	 * Used for reusing the same underlying ArrayBuffer copy when there are multiple views on the same
	 * ArrayBuffer
	 */
	const arrayBufferCopiesMap = new WeakMap<ArrayBuffer, ArrayBuffer>()

	type TypedArrayProxy<T extends AnyTypedArray> = Drafted<T, TypedArrayState<T>>

	function createTypedArrayProxy<T extends AnyTypedArray>(
		target: T,
		parent?: ImmerState
	) {
		// Preserve TypedArray kind with the same length
		const proxy: TypedArrayProxy<T> = new (Object.getPrototypeOf(
			target
		).constructor)(target.buffer)

		proxy[DRAFT_STATE] = {
			type_: ProxyTypeTypedArray,
			parent_: parent,
			scope_: parent ? parent.scope_ : getCurrentScope(),
			assigned_: {},
			modified_: false,
			finalized_: false,
			isManual_: false,
			base_: target,
			copy_: undefined,
			revoked_: false,
			draft_: null as any, // set below
			revoke_() {} // set below
		}

		return proxy
	}

	const typedArrayMethods: Record<any, any> = {}

	const mutatingTypedArrayMethodNames: (keyof AnyTypedArray)[] = [
		"copyWithin",
		"fill",
		"reverse",
		"set",
		"sort"
	]
	mutatingTypedArrayMethodNames.forEach(methodName => {
		typedArrayMethods[methodName] = function(
			this: TypedArrayProxy<AnyTypedArray>,
			...args: any[]
		) {
			assertUnrevoked(this[DRAFT_STATE])

			prepareTypedArrayCopy(this[DRAFT_STATE])
			const arr = latest(this[DRAFT_STATE])

			return Object.getPrototypeOf(arr)[methodName].apply(arr, args)
		}
	})

	const nonMutatingTypedArrayMethodNames: (
		| keyof AnyTypedArray
		| symbol
		| "toLocaleString"
	)[] = [
		"entries",
		"every",
		"filter",
		"find",
		"findIndex",
		"forEach",
		"includes",
		"indexOf",
		"join",
		"keys",
		"lastIndexOf",
		"map",
		"reduce",
		"reduceRight",
		"slice",
		"subarray",
		"values",
		"toLocaleString",
		"toString",
		Symbol.iterator
	]
	nonMutatingTypedArrayMethodNames.forEach(methodName => {
		// Type assertion to get around indexing via symbol
		typedArrayMethods[(methodName as unknown) as string] = function(
			this: TypedArrayProxy<AnyTypedArray>,
			...args: any[]
		) {
			const arr = latest(this[DRAFT_STATE])

			return Object.getPrototypeOf(arr)[methodName].apply(arr, args)
		}
	})

	function prepareTypedArrayCopy<T extends AnyTypedArray>(
		state: TypedArrayState<T>
	) {
		if (state.copy_) return

		if (arrayBufferCopiesMap.has(state.base_.buffer)) {
			// Reuse the already copied underlying array buffer
			const existingArrayBuffer = arrayBufferCopiesMap.get(state.base_.buffer)!
			state.copy_ = new (Object.getPrototypeOf(state.base_).constructor)(
				existingArrayBuffer
			)
		} else {
			state.copy_ = state.base_.slice() as T
			arrayBufferCopiesMap.set(state.base_.buffer, state.copy_.buffer)
		}
		markChanged(state)
	}

	function assertUnrevoked(state: TypedArrayState<any>) {
		if (state.revoked_) die(3, JSON.stringify(latest(state)))
	}

	const typedArrayProxyTraps: ProxyHandler<TypedArrayProxy<any>> = {
		get(target, prop) {
			if (prop in typedArrayMethods) {
				return typedArrayMethods[(prop as unknown) as string]
			} else if (prop === DRAFT_STATE) {
				// @ts-ignore
				return target[prop]
			}

			return latest(target[DRAFT_STATE])[prop]
		},
		set(target, prop, value) {
			prepareTypedArrayCopy(target[DRAFT_STATE])
			target[DRAFT_STATE].assigned_[prop as number] = true

			return Reflect.set(latest(target[DRAFT_STATE]), prop, value)
		},
		has(target, prop) {
			return prop in latest(target[DRAFT_STATE])
		},
		ownKeys(target) {
			return Reflect.ownKeys(latest(target[DRAFT_STATE]))
		}
	}

	loadPlugin("TypedArrays", {
		proxyTypedArray_(target, parent) {
			const proxyWithoutArrayTraps = createTypedArrayProxy(target, parent)
			const {revoke, proxy} = Proxy.revocable(
				proxyWithoutArrayTraps,
				typedArrayProxyTraps
			)
			proxyWithoutArrayTraps[DRAFT_STATE].revoke_ = () => {
				revoke()
				proxyWithoutArrayTraps[DRAFT_STATE].revoked_ = true
				arrayBufferCopiesMap.delete(
					proxyWithoutArrayTraps[DRAFT_STATE].base_.buffer
				)
			}
			proxyWithoutArrayTraps[DRAFT_STATE].draft_ = proxy as any

			return proxy as any
		}
	})
}
