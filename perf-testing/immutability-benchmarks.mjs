/* eslint-disable no-inner-declarations */
import "source-map-support/register"

import {produce as produce5, setAutoFreeze as setAutoFreeze5} from "immer5"
import {produce as produce6, setAutoFreeze as setAutoFreeze6} from "immer6"
import {produce as produce7, setAutoFreeze as setAutoFreeze7} from "immer7"
import {produce as produce8, setAutoFreeze as setAutoFreeze8} from "immer8"
import {produce as produce9, setAutoFreeze as setAutoFreeze9} from "immer9"
import {produce as produce10, setAutoFreeze as setAutoFreeze10} from "immer10"
import {
	produce as produce10Perf,
	setAutoFreeze as setAutoFreeze10Perf
	// Uncomment when using a build of Immer that exposes this function,
	// and enable the corresponding line in the setStrictIteration object below.
	// setUseStrictIteration as setUseStrictIteration10Perf
} from "immer10Perf"
import {create as produceMutative} from "mutative"
import {
	produce as produceMutativeCompat,
	setAutoFreeze as setAutoFreezeMutativeCompat
} from "mutative-compat"
import {
	produce as produceStructura,
	enableAutoFreeze as setAutoFreezeStructura
} from "structurajs"
import {produce as produceLimu, setAutoFreeze as setAutoFreezeLimu} from "limu"
import {bench, run, group, summary} from "mitata"

function createInitialState(arraySize = BENCHMARK_CONFIG.arraySize) {
	const initialState = {
		largeArray: Array.from({length: arraySize}, (_, i) => ({
			id: i,
			value: Math.random(),
			nested: {key: `key-${i}`, data: Math.random()},
			moreNested: {
				items: Array.from(
					{length: BENCHMARK_CONFIG.nestedArraySize},
					(_, i) => ({id: i, name: String(i)})
				)
			}
		})),
		otherData: Array.from({length: arraySize}, (_, i) => ({
			id: i,
			name: `name-${i}`,
			isActive: i % 2 === 0
		})),
		api: {
			queries: {},
			provided: {
				keys: {}
			},
			subscriptions: {}
		}
	}
	return initialState
}

const MAX = 1

const BENCHMARK_CONFIG = {
	iterations: 1,
	arraySize: 10000,
	nestedArraySize: 100,
	multiUpdateCount: 5,
	reuseStateIterations: 10
}

// Utility functions for calculating array indices based on size
const getValidIndex = (arraySize = BENCHMARK_CONFIG.arraySize) => {
	// Return a valid index (not the last one to avoid edge cases)
	return Math.min(arraySize - 2, Math.max(0, arraySize - 2))
}

const getValidId = (arraySize = BENCHMARK_CONFIG.arraySize) => {
	// Return a valid ID that exists in the array
	return Math.min(arraySize - 2, Math.max(0, arraySize - 2))
}

const add = index => ({
	type: "test/addItem",
	payload: {id: index, value: index, nested: {data: index}}
})
const remove = index => ({type: "test/removeItem", payload: index})
const filter = percentToKeep => ({
	type: "test/filterItem",
	payload: percentToKeep
})
const update = index => ({
	type: "test/updateItem",
	payload: {id: index, value: index, nestedData: index}
})
const concat = index => ({
	type: "test/concatArray",
	payload: Array.from({length: 500}, (_, i) => ({id: i, value: index}))
})

const updateHigh = index => ({
	type: "test/updateHighIndex",
	payload: {
		id:
			Math.floor(BENCHMARK_CONFIG.arraySize * 0.8) +
			(index % Math.floor(BENCHMARK_CONFIG.arraySize * 0.2)),
		value: index,
		nestedData: index
	}
})
const updateMultiple = index => ({
	type: "test/updateMultiple",
	payload: Array.from({length: BENCHMARK_CONFIG.multiUpdateCount}, (_, i) => ({
		id: (index + i) % BENCHMARK_CONFIG.arraySize,
		value: index + i,
		nestedData: index + i
	}))
})
const removeHigh = index => ({
	type: "test/removeHighIndex",
	payload:
		Math.floor(BENCHMARK_CONFIG.arraySize * 0.8) +
		(index % Math.floor(BENCHMARK_CONFIG.arraySize * 0.2))
})

const sortByIdReverse = () => ({
	type: "test/sortByIdReverse"
})

const reverseArray = () => ({
	type: "test/reverseArray"
})

// RTKQ-style action creators
const rtkqPending = index => ({
	type: "rtkq/pending",
	payload: {
		cacheKey: `some("test-${index}-")`,
		requestId: `req-${index}`,
		id: `test-${index}-`
	}
})

const rtkqResolved = index => ({
	type: "rtkq/resolved",
	payload: {
		cacheKey: `some("test-${index}-")`,
		requestId: `req-${index}`,
		id: `test-${index}-`,
		data: `test-${index}-1`
	}
})

const actions = {
	add,
	remove,
	filter,
	update,
	concat,
	// dash-named fields to improve readability in benchmark results
	"update-high": updateHigh,
	"update-multiple": updateMultiple,
	"remove-high": removeHigh,
	"sortById-reverse": sortByIdReverse,
	"reverse-array": reverseArray
}

const immerProducers = {
	// immer5: produce5,
	// immer6: produce6,
	// immer7: produce7,
	// immer8: produce8,
	// immer9: produce9,
	immer10: produce10,
	immer10Perf: produce10Perf
	// mutative: produceMutative,
	// mutativeCompat: produceMutativeCompat,
	// structura: produceStructura,
	// limu: produceLimu
}

const noop = () => {}

const setAutoFreezes = {
	vanilla: noop,
	immer5: setAutoFreeze5,
	immer6: setAutoFreeze6,
	immer7: setAutoFreeze7,
	immer8: setAutoFreeze8,
	immer9: setAutoFreeze9,
	immer10: setAutoFreeze10,
	immer10Perf: setAutoFreeze10Perf,
	mutative: noop,
	mutativeCompat: setAutoFreezeMutativeCompat,
	structura: setAutoFreezeStructura,
	limu: setAutoFreezeLimu
}

const setStrictIteration = {
	vanilla: noop,
	immer5: noop,
	immer6: noop,
	immer7: noop,
	immer8: noop,
	immer9: noop,
	immer10: noop,
	immer10Perf: noop, // setUseStrictIteration10Perf,
	mutative: noop,
	mutativeCompat: noop,
	structura: noop,
	limu: noop
}

// RTKQ-style separate reducer functions (simulating separate RTK slices)
const updateQueries = (queries, action) => {
	switch (action.type) {
		case "rtkq/pending":
			return {
				...queries,
				[action.payload.cacheKey]: {
					id: action.payload.id,
					status: "pending",
					data: undefined
				}
			}
		case "rtkq/resolved":
			return {
				...queries,
				[action.payload.cacheKey]: {
					...queries[action.payload.cacheKey],
					status: "fulfilled",
					data: action.payload.data
				}
			}
		default:
			return queries
	}
}

const updateProvided = (provided, action) => {
	switch (action.type) {
		case "rtkq/pending":
		case "rtkq/resolved":
			return {
				...provided,
				keys: {
					...provided.keys,
					[action.payload.cacheKey]: {}
				}
			}
		default:
			return provided
	}
}

const updateSubscriptions = (subscriptions, action) => {
	switch (action.type) {
		case "rtkq/pending":
			return {
				...subscriptions,
				[action.payload.cacheKey]: {
					[action.payload.requestId]: {
						pollingInterval: 0,
						skipPollingIfUnfocused: false
					}
				}
			}
		case "rtkq/resolved":
			return subscriptions // No change on resolved
		default:
			return subscriptions
	}
}

const vanillaReducer = (state = createInitialState(), action) => {
	switch (action.type) {
		case "test/addItem":
			return {
				...state,
				largeArray: [...state.largeArray, action.payload]
			}
		case "test/removeItem": {
			const newArray = state.largeArray.slice()
			newArray.splice(action.payload, 1)
			return {
				...state,
				largeArray: newArray
			}
		}
		case "test/filterItem": {
			const keepPercentage = action.payload / 10
			const length = state.largeArray.length
			const newArray = state.largeArray.filter(
				(item, i) => i / length < action.payload
			)
			return {
				...state,
				largeArray: newArray
			}
		}
		case "test/updateItem": {
			return {
				...state,
				largeArray: state.largeArray.map(item =>
					item.id === action.payload.id
						? {
								...item,
								value: action.payload.value,
								nested: {...item.nested, data: action.payload.nestedData}
						  }
						: item
				)
			}
		}
		case "test/concatArray": {
			const length = state.largeArray.length
			const newArray = action.payload.concat(state.largeArray)
			newArray.length = length
			return {
				...state,
				largeArray: newArray
			}
		}
		case "test/updateHighIndex": {
			return {
				...state,
				largeArray: state.largeArray.map(item =>
					item.id === action.payload.id
						? {
								...item,
								value: action.payload.value,
								nested: {...item.nested, data: action.payload.nestedData}
						  }
						: item
				)
			}
		}
		case "test/updateMultiple": {
			const updates = new Map(action.payload.map(p => [p.id, p]))
			return {
				...state,
				largeArray: state.largeArray.map(item => {
					const update = updates.get(item.id)
					return update
						? {
								...item,
								value: update.value,
								nested: {...item.nested, data: update.nestedData}
						  }
						: item
				})
			}
		}
		case "test/removeHighIndex": {
			const newArray = state.largeArray.slice()
			const indexToRemove = newArray.findIndex(
				item => item.id === action.payload
			)
			if (indexToRemove !== -1) {
				newArray.splice(indexToRemove, 1)
			}
			return {
				...state,
				largeArray: newArray
			}
		}
		case "test/sortByIdReverse": {
			const newArray = state.largeArray.slice()
			newArray.sort((a, b) => b.id - a.id) // Sort by ID in reverse order
			return {
				...state,
				largeArray: newArray
			}
		}
		case "test/reverseArray": {
			const newArray = state.largeArray.slice()
			newArray.reverse()
			return {
				...state,
				largeArray: newArray
			}
		}
		case "rtkq/pending":
		case "rtkq/resolved": {
			// Simulate separate RTK slice reducers with combined reducer pattern
			return {
				...state,
				api: {
					queries: updateQueries(state.api.queries, action),
					provided: updateProvided(state.api.provided, action),
					subscriptions: updateSubscriptions(state.api.subscriptions, action)
				}
			}
		}
		default:
			return state
	}
}

const createImmerReducer = produce => {
	const immerReducer = (state = createInitialState(), action) =>
		produce(state, draft => {
			switch (action.type) {
				case "test/addItem":
					draft.largeArray.push(action.payload)
					break
				case "test/removeItem":
					draft.largeArray.splice(action.payload, 1)
					break
				case "test/filterItem": {
					const keepPercentage = action.payload / 10
					const length = state.largeArray.length
					draft.largeArray = draft.largeArray.filter(
						(item, i) => i / length < action.payload
					)
					break
				}
				case "test/updateItem": {
					const item = draft.largeArray.find(
						item => item.id === action.payload.id
					)
					item.value = action.payload.value
					item.nested.data = action.payload.nestedData
					break
				}
				case "test/concatArray": {
					const length = state.largeArray.length
					const newArray = action.payload.concat(state.largeArray)
					newArray.length = length
					draft.largeArray = newArray
					break
				}
				case "test/updateHighIndex": {
					const item = draft.largeArray.find(
						item => item.id === action.payload.id
					)
					if (item) {
						item.value = action.payload.value
						item.nested.data = action.payload.nestedData
					}
					break
				}
				case "test/updateMultiple": {
					action.payload.forEach(update => {
						const item = draft.largeArray.find(item => item.id === update.id)
						if (item) {
							item.value = update.value
							item.nested.data = update.nestedData
						}
					})
					break
				}
				case "test/removeHighIndex": {
					const indexToRemove = draft.largeArray.findIndex(
						item => item.id === action.payload
					)
					if (indexToRemove !== -1) {
						draft.largeArray.splice(indexToRemove, 1)
					}
					break
				}
				case "test/sortByIdReverse": {
					draft.largeArray.sort((a, b) => b.id - a.id)
					break
				}
				case "test/reverseArray": {
					draft.largeArray.reverse()
					break
				}
				case "rtkq/pending": {
					// Simulate separate RTK slice reducers with combined reducer pattern
					const cacheKey = action.payload.cacheKey
					draft.api.queries[cacheKey] = {
						id: action.payload.id,
						status: "pending",
						data: undefined
					}
					draft.api.provided.keys[cacheKey] = {}
					draft.api.subscriptions[cacheKey] = {
						[action.payload.requestId]: {
							pollingInterval: 0,
							skipPollingIfUnfocused: false
						}
					}
					break
				}
				case "rtkq/resolved": {
					const cacheKey = action.payload.cacheKey
					draft.api.queries[cacheKey].status = "fulfilled"
					draft.api.queries[cacheKey].data = action.payload.data
					// provided and subscriptions don't change on resolved
					break
				}
			}
		})

	return immerReducer
}

function mapValues(obj, fn) {
	const result = {}
	for (const key in obj) {
		result[key] = fn(obj[key])
	}
	return result
}

const reducers = {
	vanilla: vanillaReducer,
	...mapValues(immerProducers, createImmerReducer)
}

const freeze = [false, true]

function createBenchmarks() {
	// All single-operation benchmarks (fresh state each time)
	for (const action in actions) {
		summary(function() {
			bench(`$action: $version (freeze: $freeze)`, function*(args) {
				const version = args.get("version")
				const freeze = args.get("freeze")
				const action = args.get("action")

				const initialState = createInitialState()

				function benchMethod() {
					setAutoFreezes[version](freeze)
					setStrictIteration[version](false)
					for (let i = 0; i < MAX; i++) {
						reducers[version](initialState, actions[action](i))
					}
					setAutoFreezes[version](false)
				}

				yield benchMethod
			}).args({
				version: Object.keys(reducers),
				freeze,
				action: [action]
			})
		})
	}

	// State reuse benchmarks (tests performance on frozen/evolved state)
	const reuseActions = ["update", "update-high", "remove", "remove-high"]
	for (const action of reuseActions) {
		summary(function() {
			bench(`$action-reuse: $version (freeze: $freeze)`, function*(args) {
				const version = args.get("version")
				const freeze = args.get("freeze")
				const action = args.get("action")

				function benchMethod() {
					setAutoFreezes[version](freeze)
					setStrictIteration[version](false)

					let currentState = createInitialState()

					// Perform multiple operations on the same evolving state
					for (let i = 0; i < BENCHMARK_CONFIG.reuseStateIterations; i++) {
						currentState = reducers[version](currentState, actions[action](i))
					}
					setAutoFreezes[version](false)
				}

				yield benchMethod
			}).args({
				version: Object.keys(reducers),
				freeze,
				action: [action]
			})
		})
	}

	// Mixed operations sequence benchmark
	summary(function() {
		bench(`mixed-sequence: $version (freeze: $freeze)`, function*(args) {
			const version = args.get("version")
			const freeze = args.get("freeze")

			function benchMethod() {
				setAutoFreezes[version](freeze)
				setStrictIteration[version](false)

				let state = createInitialState()

				// Perform a sequence of different operations (typical workflow)
				state = reducers[version](state, actions.add(1))
				state = reducers[version](state, actions.update(getValidId()))
				state = reducers[version](state, actions["update-high"](2))
				state = reducers[version](state, actions["update-multiple"](3))
				state = reducers[version](state, actions.remove(getValidIndex()))

				setAutoFreezes[version](false)
			}

			yield benchMethod
		}).args({
			version: Object.keys(reducers),
			freeze
		})
	})

	// RTKQ-style benchmark - executes multiple reducer calls in sequence
	summary(function() {
		bench(`rtkq-sequence: $version (freeze: $freeze)`, function*(args) {
			const version = args.get("version")
			const freeze = args.get("freeze")

			function benchMethod() {
				setAutoFreezes[version](freeze)
				setStrictIteration[version](false)

				let state = createInitialState()
				// Use smaller array size for RTKQ benchmark due to exponential scaling
				// 100 items = ~15ms, 200 items = ~32ms, so 10000 would be impractical
				const arraySize = 100

				// Phase 1: Execute all pending actions
				for (let i = 0; i < arraySize; i++) {
					state = reducers[version](state, rtkqPending(i))
				}

				// Phase 2: Execute all resolved actions
				for (let i = 0; i < arraySize; i++) {
					state = reducers[version](state, rtkqResolved(i))
				}

				setAutoFreezes[version](false)
			}

			yield benchMethod
		}).args({
			version: Object.keys(reducers),
			freeze
		})
	})
}
}

async function main() {
	createBenchmarks()
	await run()
	process.exit(0)
}

main()
