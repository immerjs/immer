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
		}))
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

const actions = {
	add,
	remove,
	filter,
	update,
	concat
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

function createBenchmarks() {
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
				freeze: [false, true],
				action: [action]
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
