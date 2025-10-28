import {produce} from "../dist/immer.mjs"

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
	arraySize: 100,
	nestedArraySize: 10,
	multiUpdateCount: 5,
	reuseStateIterations: 10
}

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

const createImmerReducer = produce => {
	const immerReducer = (state = createInitialState(), action) =>
		produce(state, draft => {
			switch (action.type) {
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

const immerReducer = createImmerReducer(produce)
const initialState = createInitialState()

const arraySizes = [10, 100, 250, 500, 1000, 1021, 1500, 2000, 3000]

for (const arraySize of arraySizes) {
	console.log(`Running benchmark with array size: ${arraySize}`)

	const start = performance.now()

	let state = initialState

	// Phase 1: Execute all pending actions
	for (let i = 0; i < arraySize; i++) {
		state = immerReducer(state, rtkqPending(i))
	}

	// Phase 2: Execute all resolved actions
	for (let i = 0; i < arraySize; i++) {
		state = immerReducer(state, rtkqResolved(i))
	}

	const end = performance.now()
	const total = end - start
	const avg = total / arraySize

	console.log(
		`Done in ${total.toFixed(1)} ms (items: ${arraySize}, avg: ${avg.toFixed(
			3
		)} ms / item)`
	)
}
