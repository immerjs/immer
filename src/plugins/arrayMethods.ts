import {
	PluginArrayMethods,
	latest,
	loadPlugin,
	markChanged,
	prepareCopy,
	ProxyArrayState
} from "../internal"

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
export type ArrayOperationMethod = MutatingArrayMethod | NonMutatingArrayMethod

export function enableArrayMethods() {
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
	function isMutatingArrayMethod(
		method: string
	): method is MutatingArrayMethod {
		return MUTATING_METHODS.has(method as any)
	}

	function isNonMutatingArrayMethod(
		method: string
	): method is NonMutatingArrayMethod {
		return NON_MUTATING_METHODS.has(method as any)
	}

	function isArrayOperationMethod(
		method: string
	): method is ArrayOperationMethod {
		return isMutatingArrayMethod(method) || isNonMutatingArrayMethod(method)
	}

	function enterOperation(
		state: ProxyArrayState,
		method: ArrayOperationMethod
	) {
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

	function createMethodInterceptor(
		state: ProxyArrayState,
		originalMethod: string
	) {
		return function interceptedMethod(...args: any[]) {
			// Enter operation mode
			const method = originalMethod as ArrayOperationMethod
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

	loadPlugin(PluginArrayMethods, {
		createMethodInterceptor,
		isArrayOperationMethod,
		isMutatingArrayMethod
	})
}
