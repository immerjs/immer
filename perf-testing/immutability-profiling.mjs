/* eslint-disable no-inner-declarations */
import {produce, setAutoFreeze} from "../dist/immer.mjs"

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROFILING_CONFIG = {
	// How many times to run each scenario (can be overridden via CLI)
	iterations: parseInt(process.argv[2]) || 100,

	// Which scenarios to run
	scenarios: [
		// Single operations
		"add",
		"remove",
		"update",
		"update-high",
		"update-multiple",
		"remove-high",
		"update-largeObject1",
		"update-largeObject2",
		"concat",
		"mapNested",
		"sortById-reverse",
		"reverse-array",

		// Reuse scenarios (state evolution)
		"update-reuse",
		"update-high-reuse",
		"remove-reuse",
		"remove-high-reuse",
		"update-largeObject1-reuse",
		"update-largeObject2-reuse",

		// Complex sequences
		"mixed-sequence",
		"rtkq-sequence"
	]
}

const BENCHMARK_CONFIG = {
	arraySize: 100,
	nestedArraySize: 10,
	largeObjectSize1: 1000,
	largeObjectSize2: 3000,
	multiUpdateCount: 5,
	reuseStateIterations: 10
}

const MAX = 1

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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
		largeObject1: createLargeObject(BENCHMARK_CONFIG.largeObjectSize1),
		largeObject2: createLargeObject(BENCHMARK_CONFIG.largeObjectSize2),
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

function createLargeObject(size = 100) {
	const obj = {}
	for (let i = 0; i < size; i++) {
		obj[`property${i}`] = {
			id: i,
			value: Math.random(),
			name: `item-${i}`,
			active: i % 2 === 0
		}
	}
	return obj
}

const getValidIndex = (arraySize = BENCHMARK_CONFIG.arraySize) => {
	return Math.min(arraySize - 2, Math.max(0, arraySize - 2))
}

const getValidId = (arraySize = BENCHMARK_CONFIG.arraySize) => {
	return Math.min(arraySize - 2, Math.max(0, arraySize - 2))
}

// ============================================================================
// ACTION CREATORS
// ============================================================================

const add = index => ({
	type: "test/addItem",
	payload: {id: index, value: index, nested: {data: index}}
})

const remove = index => ({type: "test/removeItem", payload: index})

const update = index => ({
	type: "test/updateItem",
	payload: {id: index, value: index, nestedData: index}
})

const updateLargeObject1 = index => ({
	type: "test/updateLargeObject1",
	payload: {value: index}
})

const updateLargeObject2 = index => ({
	type: "test/updateLargeObject2",
	payload: {value: index}
})

const concat = index => ({
	type: "test/concatArray",
	payload: Array.from({length: 500}, (_, i) => ({id: i, value: index}))
})

const mapNested = () => ({
	type: "test/mapNested"
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
	update,
	concat,
	mapNested,
	"update-largeObject1": updateLargeObject1,
	"update-largeObject2": updateLargeObject2,
	"update-high": updateHigh,
	"update-multiple": updateMultiple,
	"remove-high": removeHigh,
	"sortById-reverse": sortByIdReverse,
	"reverse-array": reverseArray
}

// ============================================================================
// REDUCER IMPLEMENTATION
// ============================================================================

const immerReducer = (state = createInitialState(), action) =>
	produce(state, draft => {
		switch (action.type) {
			case "test/addItem":
				draft.largeArray.push(action.payload)
				break
			case "test/removeItem":
				draft.largeArray.splice(action.payload, 1)
				break
			case "test/updateItem": {
				const item = draft.largeArray.find(
					item => item.id === action.payload.id
				)
				item.value = action.payload.value
				item.nested.data = action.payload.nestedData
				break
			}
			case "test/updateLargeObject1": {
				draft.largeObject1[`propertyAdded${action.payload.value}`] = {
					id: action.payload.value
				}
				break
			}
			case "test/updateLargeObject2": {
				draft.largeObject2[`propertyAdded${action.payload.value}`] = {
					id: action.payload.value
				}
				break
			}
			case "test/concatArray": {
				const length = state.largeArray.length
				const newArray = action.payload.concat(state.largeArray)
				newArray.length = length
				draft.largeArray = newArray
				break
			}
			case "test/mapNested": {
				draft.otherData = draft.largeArray.map(item => item.nested)
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
				break
			}
		}
	})

// ============================================================================
// SCENARIO FUNCTIONS
// ============================================================================

// Single operation scenarios - execute once
function scenario_add() {
	const initialState = createInitialState()
	for (let j = 0; j < MAX; j++) {
		immerReducer(initialState, actions.add(j))
	}
}

function scenario_remove() {
	const initialState = createInitialState()
	for (let j = 0; j < MAX; j++) {
		immerReducer(initialState, actions.remove(j))
	}
}

function scenario_update() {
	const initialState = createInitialState()
	for (let j = 0; j < MAX; j++) {
		immerReducer(initialState, actions.update(j))
	}
}

function scenario_update_high() {
	const initialState = createInitialState()
	for (let j = 0; j < MAX; j++) {
		immerReducer(initialState, actions["update-high"](j))
	}
}

function scenario_update_multiple() {
	const initialState = createInitialState()
	for (let j = 0; j < MAX; j++) {
		immerReducer(initialState, actions["update-multiple"](j))
	}
}

function scenario_remove_high() {
	const initialState = createInitialState()
	for (let j = 0; j < MAX; j++) {
		immerReducer(initialState, actions["remove-high"](j))
	}
}

function scenario_update_largeObject1() {
	const initialState = createInitialState()
	for (let j = 0; j < MAX; j++) {
		immerReducer(initialState, actions["update-largeObject1"](j))
	}
}

function scenario_update_largeObject2() {
	const initialState = createInitialState()
	for (let j = 0; j < MAX; j++) {
		immerReducer(initialState, actions["update-largeObject2"](j))
	}
}

function scenario_concat() {
	const initialState = createInitialState()
	for (let j = 0; j < MAX; j++) {
		immerReducer(initialState, actions.concat(j))
	}
}

function scenario_mapNested() {
	const initialState = createInitialState()
	for (let j = 0; j < MAX; j++) {
		immerReducer(initialState, actions.mapNested())
	}
}

function scenario_sortById_reverse() {
	const initialState = createInitialState()
	for (let j = 0; j < MAX; j++) {
		immerReducer(initialState, actions["sortById-reverse"]())
	}
}

function scenario_reverse_array() {
	const initialState = createInitialState()
	for (let j = 0; j < MAX; j++) {
		immerReducer(initialState, actions["reverse-array"]())
	}
}

// Reuse scenarios - execute full state evolution sequence once
function scenario_update_reuse() {
	let currentState = createInitialState()

	for (let j = 0; j < BENCHMARK_CONFIG.reuseStateIterations; j++) {
		currentState = immerReducer(currentState, actions.update(j))
	}
}

function scenario_update_high_reuse() {
	let currentState = createInitialState()

	for (let j = 0; j < BENCHMARK_CONFIG.reuseStateIterations; j++) {
		currentState = immerReducer(currentState, actions["update-high"](j))
	}
}

function scenario_remove_reuse() {
	let currentState = createInitialState()

	for (let j = 0; j < BENCHMARK_CONFIG.reuseStateIterations; j++) {
		currentState = immerReducer(currentState, actions.remove(j))
	}
}

function scenario_remove_high_reuse() {
	let currentState = createInitialState()

	for (let j = 0; j < BENCHMARK_CONFIG.reuseStateIterations; j++) {
		currentState = immerReducer(currentState, actions["remove-high"](j))
	}
}

function scenario_update_largeObject1_reuse() {
	let currentState = createInitialState()

	for (let j = 0; j < BENCHMARK_CONFIG.reuseStateIterations; j++) {
		currentState = immerReducer(currentState, actions["update-largeObject1"](j))
	}
}

function scenario_update_largeObject2_reuse() {
	let currentState = createInitialState()

	for (let j = 0; j < BENCHMARK_CONFIG.reuseStateIterations; j++) {
		currentState = immerReducer(currentState, actions["update-largeObject2"](j))
	}
}

// Complex sequence scenarios - execute full sequence once
function scenario_mixed_sequence() {
	let state = createInitialState()
	state = immerReducer(state, actions.add(1))
	state = immerReducer(state, actions.update(getValidId()))
	state = immerReducer(state, actions["update-high"](2))
	state = immerReducer(state, actions["update-multiple"](3))
	state = immerReducer(state, actions.remove(getValidIndex()))
}

function scenario_rtkq_sequence() {
	let state = createInitialState()
	const arraySize = 100

	// Phase 1: Execute all pending actions
	for (let j = 0; j < arraySize; j++) {
		state = immerReducer(state, rtkqPending(j))
	}

	// Phase 2: Execute all resolved actions
	for (let j = 0; j < arraySize; j++) {
		state = immerReducer(state, rtkqResolved(j))
	}
}

// ============================================================================
// SCENARIO REGISTRY
// ============================================================================

const scenarios = {
	// Single operations
	add: scenario_add,
	remove: scenario_remove,
	update: scenario_update,
	"update-high": scenario_update_high,
	"update-multiple": scenario_update_multiple,
	"remove-high": scenario_remove_high,
	"update-largeObject1": scenario_update_largeObject1,
	"update-largeObject2": scenario_update_largeObject2,
	concat: scenario_concat,
	mapNested: scenario_mapNested,
	"sortById-reverse": scenario_sortById_reverse,
	"reverse-array": scenario_reverse_array,

	// Reuse scenarios
	"update-reuse": scenario_update_reuse,
	"update-high-reuse": scenario_update_high_reuse,
	"remove-reuse": scenario_remove_reuse,
	"remove-high-reuse": scenario_remove_high_reuse,
	"update-largeObject1-reuse": scenario_update_largeObject1_reuse,
	"update-largeObject2-reuse": scenario_update_largeObject2_reuse,

	// Complex sequences
	"mixed-sequence": scenario_mixed_sequence,
	"rtkq-sequence": scenario_rtkq_sequence
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
	// Set freeze to true (default Immer behavior)
	setAutoFreeze(true)

	console.log("=".repeat(80))
	console.log("IMMER PROFILING SCRIPT (freeze: true)")
	console.log("=".repeat(80))
	console.log(`Iterations per scenario: ${PROFILING_CONFIG.iterations}`)
	console.log(`Total scenarios: ${PROFILING_CONFIG.scenarios.length}`)
	console.log("=".repeat(80))
	console.log()

	let completed = 0
	for (const scenarioName of PROFILING_CONFIG.scenarios) {
		const scenarioFn = scenarios[scenarioName]
		if (!scenarioFn) {
			console.log(`⚠ Skipping unknown scenario: ${scenarioName}`)
			continue
		}

		const start = performance.now()

		// Driver loop handles iterations
		for (let i = 0; i < PROFILING_CONFIG.iterations; i++) {
			scenarioFn()
		}

		const duration = performance.now() - start

		completed++
		console.log(
			`[${completed}/${
				PROFILING_CONFIG.scenarios.length
			}] ✓ ${scenarioName} - ${duration.toFixed(2)}ms`
		)
	}

	console.log()
	console.log("=".repeat(80))
	console.log("Profiling complete!")
	console.log("=".repeat(80))
}

main()
