import {
	each,
	has,
	is,
	isDraftable,
	shallowCopy,
	latest,
	ImmerBaseState,
	ImmerState,
	Drafted,
	AnyObject,
	AnyArray,
	Objectish,
	getCurrentScope,
	getPrototypeOf,
	DRAFT_STATE,
	die,
	createProxy,
	ArchType,
	ImmerScope,
	handleCrossReference,
	WRITABLE,
	CONFIGURABLE,
	ENUMERABLE,
	VALUE,
	isArray,
	isArrayIndex
} from "../internal"

interface ProxyBaseState extends ImmerBaseState {
	parent_?: ImmerState
	revoke_(): void
}

export interface ProxyObjectState extends ProxyBaseState {
	type_: ArchType.Object
	base_: any
	copy_: any
	draft_: Drafted<AnyObject, ProxyObjectState>
}

export interface ProxyArrayState extends ProxyBaseState {
	type_: ArchType.Array
	base_: AnyArray
	copy_: AnyArray | null
	draft_: Drafted<AnyArray, ProxyArrayState>
	operationMethod?: ArrayOperationMethod
	allIndicesReassigned_?: boolean
}

type ProxyState = ProxyObjectState | ProxyArrayState

/**
 * Returns a new draft of the `base` object.
 *
 * The second argument is the parent draft-state (used internally).
 */
export function createProxyProxy<T extends Objectish>(
	base: T,
	parent?: ImmerState
): [Drafted<T, ProxyState>, ProxyState] {
	const baseIsArray = isArray(base)
	const state: ProxyState = {
		type_: baseIsArray ? ArchType.Array : (ArchType.Object as any),
		// Track which produce call this is associated with.
		scope_: parent ? parent.scope_ : getCurrentScope()!,
		// True for both shallow and deep changes.
		modified_: false,
		// Used during finalization.
		finalized_: false,
		// Track which properties have been assigned (true) or deleted (false).
		// actually instantiated in `prepareCopy()`
		assigned_: undefined,
		// The parent draft state.
		parent_: parent,
		// The base state.
		base_: base,
		// The base proxy.
		draft_: null as any, // set below
		// The base copy with any updated values.
		copy_: null,
		// Called by the `produce` function.
		revoke_: null as any,
		isManual_: false,
		// `callbacks` actually gets assigned in `createProxy`
		callbacks_: undefined as any
	}

	// the traps must target something, a bit like the 'real' base.
	// but also, we need to be able to determine from the target what the relevant state is
	// (to avoid creating traps per instance to capture the state in closure,
	// and to avoid creating weird hidden properties as well)
	// So the trick is to use 'state' as the actual 'target'! (and make sure we intercept everything)
	// Note that in the case of an array, we put the state in an array to have better Reflect defaults ootb
	let target: T = state as any
	let traps: ProxyHandler<object | Array<any>> = objectTraps
	if (baseIsArray) {
		target = [state] as any
		traps = arrayTraps
	}

	const {revoke, proxy} = Proxy.revocable(target, traps)
	state.draft_ = proxy as any
	state.revoke_ = revoke
	return [proxy as any, state]
}

/**
 * Object drafts
 */
export const objectTraps: ProxyHandler<ProxyState> = {
	get(state, prop) {
		if (prop === DRAFT_STATE) return state

		// Intercept array methods so that we can override
		// behavior and skip proxy creation for perf
		if (
			state.type_ === ArchType.Array &&
			typeof prop === "string" &&
			isArrayOperationMethod(prop)
		) {
			return createMethodInterceptor(state, prop)
		}

		const source = latest(state)
		if (!has(source, prop, state.type_)) {
			// non-existing or non-own property...
			return readPropFromProto(state, source, prop)
		}
		const value = source[prop]
		if (state.finalized_ || !isDraftable(value)) {
			return value
		}

		// During mutating array operations, defer proxy creation for array elements
		// This optimization avoids creating unnecessary proxies during sort/reverse
		if (
			state.type_ === ArchType.Array &&
			(state as ProxyArrayState).operationMethod &&
			isMutatingArrayMethod((state as ProxyArrayState).operationMethod!) &&
			isArrayIndex(prop)
		) {
			// Return raw value during mutating operations, create proxy only if modified
			return value
		}
		// Check for existing draft in modified state.
		// Assigned values are never drafted. This catches any drafts we created, too.
		if (value === peek(state.base_, prop)) {
			prepareCopy(state)
			// Ensure array keys are always numbers
			const childKey = state.type_ === ArchType.Array ? +(prop as string) : prop
			const childDraft = createProxy(state.scope_, value, state, childKey)

			return (state.copy_![childKey] = childDraft)
		}
		return value
	},
	has(state, prop) {
		return prop in latest(state)
	},
	ownKeys(state) {
		return Reflect.ownKeys(latest(state))
	},
	set(
		state: ProxyObjectState,
		prop: string /* strictly not, but helps TS */,
		value
	) {
		const desc = getDescriptorFromProto(latest(state), prop)
		if (desc?.set) {
			// special case: if this write is captured by a setter, we have
			// to trigger it with the correct context
			desc.set.call(state.draft_, value)
			return true
		}
		if (!state.modified_) {
			// the last check is because we need to be able to distinguish setting a non-existing to undefined (which is a change)
			// from setting an existing property with value undefined to undefined (which is not a change)
			const current = peek(latest(state), prop)
			// special case, if we assigning the original value to a draft, we can ignore the assignment
			const currentState: ProxyObjectState = current?.[DRAFT_STATE]
			if (currentState && currentState.base_ === value) {
				state.copy_![prop] = value
				state.assigned_!.set(prop, false)
				return true
			}
			if (
				is(value, current) &&
				(value !== undefined || has(state.base_, prop, state.type_))
			)
				return true
			prepareCopy(state)
			markChanged(state)
		}

		if (
			(state.copy_![prop] === value &&
				// special case: handle new props with value 'undefined'
				(value !== undefined || prop in state.copy_)) ||
			// special case: NaN
			(Number.isNaN(value) && Number.isNaN(state.copy_![prop]))
		)
			return true

		// @ts-ignore
		state.copy_![prop] = value
		state.assigned_!.set(prop, true)

		handleCrossReference(state, prop, value)
		return true
	},
	deleteProperty(state, prop: string) {
		prepareCopy(state)
		// The `undefined` check is a fast path for pre-existing keys.
		if (peek(state.base_, prop) !== undefined || prop in state.base_) {
			state.assigned_!.set(prop, false)
			markChanged(state)
		} else {
			// if an originally not assigned property was deleted
			state.assigned_!.delete(prop)
		}
		if (state.copy_) {
			delete state.copy_[prop]
		}
		return true
	},
	// Note: We never coerce `desc.value` into an Immer draft, because we can't make
	// the same guarantee in ES5 mode.
	getOwnPropertyDescriptor(state, prop) {
		const owner = latest(state)
		const desc = Reflect.getOwnPropertyDescriptor(owner, prop)
		if (!desc) return desc
		return {
			[WRITABLE]: true,
			[CONFIGURABLE]: state.type_ !== ArchType.Array || prop !== "length",
			[ENUMERABLE]: desc[ENUMERABLE],
			[VALUE]: owner[prop]
		}
	},
	defineProperty() {
		die(11)
	},
	getPrototypeOf(state) {
		return getPrototypeOf(state.base_)
	},
	setPrototypeOf() {
		die(12)
	}
}

/**
 * Array drafts
 */

const arrayTraps: ProxyHandler<[ProxyArrayState]> = {}
each(objectTraps, (key, fn) => {
	// @ts-ignore
	arrayTraps[key] = function() {
		const args = arguments
		args[0] = args[0][0]
		return fn.apply(this, args)
	}
})
arrayTraps.deleteProperty = function(state, prop) {
	if (process.env.NODE_ENV !== "production" && isNaN(parseInt(prop as any)))
		die(13)
	// @ts-ignore
	return arrayTraps.set!.call(this, state, prop, undefined)
}
arrayTraps.set = function(state, prop, value) {
	if (
		process.env.NODE_ENV !== "production" &&
		prop !== "length" &&
		isNaN(parseInt(prop as any))
	)
		die(14)
	return objectTraps.set!.call(this, state[0], prop, value, state[0])
}

// Type-safe union of mutating array method names
type MutatingArrayMethod =
	| "push"
	| "pop"
	| "shift"
	| "unshift"
	| "splice"
	| "reverse"
	| "sort"

// Type-safe union of non-mutating array method names
type NonMutatingArrayMethod =
	| "filter"
	| "slice"
	| "concat"
	| "flat"
	| "find"
	| "findIndex"
	| "findLast"
	| "findLastIndex"
	| "some"
	| "every"
	| "reduce"
	| "reduceRight"
	| "indexOf"
	| "lastIndexOf"
	| "includes"
	| "join"
	| "toString"
	| "toLocaleString"

// Union of all array operation methods
type ArrayOperationMethod = MutatingArrayMethod | NonMutatingArrayMethod

const SHIFTING_METHODS = new Set<MutatingArrayMethod>(["shift", "unshift"])

const QUEUE_METHODS = new Set<MutatingArrayMethod>(["push", "pop"])

const RESULT_RETURNING_METHODS = new Set<MutatingArrayMethod>([
	...QUEUE_METHODS,
	...SHIFTING_METHODS
])

const REORDERING_METHODS = new Set<MutatingArrayMethod>(["reverse", "sort"])

// Optimized method detection using array-based lookup
const MUTATING_METHODS = new Set<MutatingArrayMethod>([
	...RESULT_RETURNING_METHODS,
	...REORDERING_METHODS,
	"splice"
])

const FIND_METHODS = new Set<NonMutatingArrayMethod>(["find", "findLast"])

const NON_MUTATING_METHODS = new Set<NonMutatingArrayMethod>([
	"filter",
	"slice",
	"concat",
	"flat",
	...FIND_METHODS,
	"findIndex",
	"findLastIndex",
	"some",
	"every",
	"indexOf",
	"lastIndexOf",
	"includes",
	"join",
	"toString",
	"toLocaleString"
])

// Type guard for method detection
export function isMutatingArrayMethod(
	method: string
): method is MutatingArrayMethod {
	return MUTATING_METHODS.has(method as any)
}

export function isNonMutatingArrayMethod(
	method: string
): method is NonMutatingArrayMethod {
	return NON_MUTATING_METHODS.has(method as any)
}

export function isArrayOperationMethod(
	method: string
): method is ArrayOperationMethod {
	return isMutatingArrayMethod(method) || isNonMutatingArrayMethod(method)
}

function enterOperation(state: ProxyArrayState, method: ArrayOperationMethod) {
	state.operationMethod = method
}

function exitOperation(state: ProxyArrayState) {
	state.operationMethod = undefined
}

// Shared utility functions for array method handlers
function executeArrayMethod<T>(
	state: ProxyArrayState,
	operation: () => T,
	markLength = true
): T {
	prepareCopy(state)
	const result = operation()
	markChanged(state)
	if (markLength) state.assigned_!.set("length", true)
	return result
}

function markAllIndicesReassigned(state: ProxyArrayState) {
	state.allIndicesReassigned_ = true
}

function normalizeSliceIndex(index: number, length: number): number {
	if (index < 0) {
		return Math.max(length + index, 0)
	}
	return Math.min(index, length)
}

// Consolidated handler functions
function handleSimpleOperation(
	state: ProxyArrayState,
	method: string,
	args: any[]
) {
	return executeArrayMethod(state, () => {
		const result = (state.copy_! as any)[method](...args)

		// Handle index reassignment for shifting methods
		if (SHIFTING_METHODS.has(method as MutatingArrayMethod)) {
			markAllIndicesReassigned(state)
		}

		// Return appropriate value based on method
		return RESULT_RETURNING_METHODS.has(method as MutatingArrayMethod)
			? result
			: state.draft_
	})
}

function handleReorderingOperation(
	state: ProxyArrayState,
	method: string,
	args: any[]
) {
	return executeArrayMethod(
		state,
		() => {
			;(state.copy_! as any)[method](...args)
			markAllIndicesReassigned(state)
			return state.draft_
		},
		false
	) // Don't mark length as changed
}

export function createMethodInterceptor(
	state: ProxyArrayState,
	method: ArrayOperationMethod
) {
	return function interceptedMethod(...args: any[]) {
		// Enter operation mode
		enterOperation(state, method)

		try {
			// Check if this is a mutating method
			if (isMutatingArrayMethod(method)) {
				// Direct method dispatch - no configuration lookup needed
				if (RESULT_RETURNING_METHODS.has(method)) {
					return handleSimpleOperation(state, method, args)
				}
				if (REORDERING_METHODS.has(method)) {
					return handleReorderingOperation(state, method, args)
				}

				if (method === "splice") {
					const res = executeArrayMethod(state, () =>
						state.copy_!.splice(...(args as [number, number, ...any[]]))
					)
					markAllIndicesReassigned(state)
					return res
				}
			} else {
				// Handle non-mutating methods
				return handleNonMutatingOperation(state, method, args)
			}
		} finally {
			// Always exit operation mode
			exitOperation(state)
		}
	}
}

function handleNonMutatingOperation(
	state: ProxyArrayState,
	method: NonMutatingArrayMethod,
	args: any[]
) {
	const source = latest(state)

	// Methods that return arrays with selected items - need to return drafts
	if (method === "filter") {
		const predicate = args[0]
		const result: any[] = []

		// First pass: call predicate on base values to determine which items pass
		for (let i = 0; i < source.length; i++) {
			if (predicate(source[i], i, source)) {
				// Only create draft for items that passed the predicate
				result.push(state.draft_[i])
			}
		}

		return result
	}

	if (FIND_METHODS.has(method)) {
		const predicate = args[0]
		const isForward = method === "find"
		const step = isForward ? 1 : -1
		const start = isForward ? 0 : source.length - 1

		for (let i = start; i >= 0 && i < source.length; i += step) {
			if (predicate(source[i], i, source)) {
				return state.draft_[i]
			}
		}
		return undefined
	}

	if (method === "slice") {
		const rawStart = args[0] ?? 0
		const rawEnd = args[1] ?? source.length

		// Normalize negative indices
		const start = normalizeSliceIndex(rawStart, source.length)
		const end = normalizeSliceIndex(rawEnd, source.length)

		const result: any[] = []

		// Return drafts for items in the slice range
		for (let i = start; i < end; i++) {
			result.push(state.draft_[i])
		}

		return result
	}

	// For other methods (indexOf, includes, join, etc.), call on base array
	// These don't need drafts since they don't expose items for mutation
	return source[method as keyof typeof Array.prototype](...args)
}

// Access a property without creating an Immer draft.
function peek(draft: Drafted, prop: PropertyKey) {
	const state = draft[DRAFT_STATE]
	const source = state ? latest(state) : draft
	return source[prop]
}

function readPropFromProto(state: ImmerState, source: any, prop: PropertyKey) {
	const desc = getDescriptorFromProto(source, prop)
	return desc
		? VALUE in desc
			? desc[VALUE]
			: // This is a very special case, if the prop is a getter defined by the
			  // prototype, we should invoke it with the draft as context!
			  desc.get?.call(state.draft_)
		: undefined
}

function getDescriptorFromProto(
	source: any,
	prop: PropertyKey
): PropertyDescriptor | undefined {
	// 'in' checks proto!
	if (!(prop in source)) return undefined
	let proto = getPrototypeOf(source)
	while (proto) {
		const desc = Object.getOwnPropertyDescriptor(proto, prop)
		if (desc) return desc
		proto = getPrototypeOf(proto)
	}
	return undefined
}

export function markChanged(state: ImmerState) {
	if (!state.modified_) {
		state.modified_ = true
		if (state.parent_) {
			markChanged(state.parent_)
		}
	}
}

export function prepareCopy(state: ImmerState) {
	if (!state.copy_) {
		// Actually create the `assigned_` map now that we
		// know this is a modified draft.
		state.assigned_ = new Map()
		state.copy_ = shallowCopy(
			state.base_,
			state.scope_.immer_.useStrictShallowCopy_
		)
	}
}
