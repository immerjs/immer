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
		largeObject: createLargeObject(BENCHMARK_CONFIG.largeObjectSize),
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
	largeObjectSize: 1000,
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
const updateLargeObject = index => ({
	type: "test/updateLargeObject",
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
	updateLargeObject,
	concat,
	mapNested,
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
		case "test/updateLargeObject": {
			return {
				...state,
				largeObject: {
					...state.largeObject,
					[`propertyAdded${action.payload.value}`]: {
						id: action.payload.value
					}
				}
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
		case "test/mapNested": {
			// Extract nested data - common pattern for denormalization or view preparation
			const nestedData = state.largeArray.map(item => item.nested)
			return {
				...state,
				otherData: nestedData // Store extracted nested objects
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
				case "test/updateLargeObject": {
					draft.largeObject[`propertyAdded${action.payload.value}`] = {
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
					// Extract nested data
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
	const reuseActions = [
		"update",
		"update-high",
		"remove",
		"remove-high",
		"updateLargeObject"
	]
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

// Summary table functionality
function extractBenchmarkData(benchmarks) {
	const data = []

	for (const trial of benchmarks) {
		for (const run of trial.runs) {
			if (run.error || !run.stats) continue

			// Parse benchmark name to extract scenario, version, and freeze setting
			// Expected format: "scenario: version (freeze: true/false)"
			const match = run.name.match(
				/^(.+?):\s*(.+?)\s*\(freeze:\s*(true|false)\)$/
			)
			if (!match) continue

			const [, scenario, version, freeze] = match
			const freezeIndicator = freeze === "true" ? "f+" : "f-"
			const versionKey = `${version.trim()}|${freezeIndicator}`

			data.push({
				scenario: scenario.trim(),
				version: version.trim(),
				freeze: freeze === "true",
				freezeIndicator,
				versionKey,
				avgTime: run.stats.avg,
				stats: run.stats
			})
		}
	}

	return data
}

function organizeBenchmarkMatrix(data) {
	const matrix = {}
	const scenarios = new Set()
	const versions = new Set()

	// Organize data into matrix structure
	for (const item of data) {
		scenarios.add(item.scenario)
		versions.add(item.versionKey)

		if (!matrix[item.scenario]) {
			matrix[item.scenario] = {}
		}

		matrix[item.scenario][item.versionKey] = {
			avgTime: item.avgTime,
			stats: item.stats
		}
	}

	return {
		matrix,
		scenarios: Array.from(scenarios).sort(),
		versions: Array.from(versions).sort()
	}
}

function calculateRelativePerformanceAndRankings(matrix, scenarios, versions) {
	const relativeData = {}
	const rankings = {}

	for (const scenario of scenarios) {
		const scenarioData = matrix[scenario] || {}
		const validVersions = versions.filter(v => scenarioData[v])

		if (validVersions.length === 0) continue

		// Find fastest time for this scenario
		const times = validVersions.map(v => ({
			version: v,
			time: scenarioData[v].avgTime
		}))

		times.sort((a, b) => a.time - b.time)
		const fastestTime = times[0].time

		// Calculate relative performance and rankings
		relativeData[scenario] = {}
		rankings[scenario] = {}

		times.forEach((item, index) => {
			const multiplier = item.time / fastestTime
			relativeData[scenario][item.version] = multiplier
			rankings[scenario][item.version] = index + 1
		})
	}

	return {relativeData, rankings}
}

function formatTime(nanoseconds) {
	// Use similar formatting to Mitata's $.time function, but more compact
	if (nanoseconds < 1) return `${(nanoseconds * 1e3).toFixed(1)}ps`
	if (nanoseconds < 1e3) return `${nanoseconds.toFixed(1)}ns`

	let ns = nanoseconds / 1000
	if (ns < 1e3) return `${ns.toFixed(1)}µs`

	ns /= 1000
	if (ns < 1e3) return `${ns.toFixed(1)}ms`

	ns /= 1000
	if (ns < 1e3) return `${ns.toFixed(1)}s`

	return `${ns.toFixed(1)}s`
}

function formatRanking(rank) {
	const suffixes = ["th", "st", "nd", "rd"]
	const suffix = rank >= 11 && rank <= 13 ? "th" : suffixes[rank % 10] || "th"
	return `${rank}${suffix}`
}

function formatMultiplier(relative) {
	if (relative === 1) return "1.0x"

	// If the multiplier is 4+ digits (1000+), don't show decimals
	if (relative >= 1000) {
		return `${Math.round(relative)}x`
	}

	return `${relative.toFixed(1)}x`
}

function shortenVersionName(versionName) {
	// Special case common long version names to save space
	const shortNames = {
		immer10Perf: "i10Perf",
		immer10: "i10",
		immer5: "i5",
		immer6: "i6",
		immer7: "i7",
		immer8: "i8",
		immer9: "i9",
		mutativeCompat: "mutatv-c",
		mutative: "mutatv",
		structura: "struct",
		vanilla: "vanilla"
	}

	return shortNames[versionName] || versionName
}

function formatScenarioName(scenario, maxWidth) {
	// If the scenario contains hyphens and is too long, split on hyphens
	// and display on multiple lines within the cell
	if (scenario.includes("-") && scenario.length > maxWidth) {
		const parts = scenario.split("-")
		return parts
	}

	// For non-hyphenated scenarios, truncate if needed
	if (scenario.length > maxWidth) {
		return [scenario.substring(0, maxWidth - 2) + ".."]
	}

	return [scenario]
}

function printSummaryTable(
	matrix,
	scenarios,
	versions,
	relativeData,
	rankings
) {
	console.log("\n")
	console.log("=".repeat(80))
	console.log("BENCHMARK SUMMARY TABLE")
	console.log("=".repeat(80))

	if (scenarios.length === 0 || versions.length === 0) {
		console.log("No benchmark data available for summary table.")
		return
	}

	// Parse version keys to get version names and freeze indicators
	const versionInfo = versions.map(v => {
		const [versionName, freezeIndicator] = v.split("|")
		const shortName = shortenVersionName(versionName)
		return {
			key: v,
			name: shortName,
			freeze: freezeIndicator,
			originalName: versionName
		}
	})

	// Fixed column widths for consistent alignment - 9 chars content + separators
	const scenarioWidth = 9
	const versionWidth = 8

	// Print header with 9-char content + padding
	let header = "┌" + "─".repeat(scenarioWidth + 2)
	for (let i = 0; i < versions.length; i++) {
		header += "┬" + "─".repeat(versionWidth)
	}
	header += "┐"
	console.log(header)

	// Print column headers - version names
	let headerRow1 = "│ " + "Scenario".padEnd(scenarioWidth) + " "
	for (const vInfo of versionInfo) {
		headerRow1 += "│" + vInfo.name.padEnd(versionWidth)
	}
	headerRow1 += "│"
	console.log(headerRow1)

	// Print column headers - freeze indicators
	let headerRow2 = "│ " + "".padEnd(scenarioWidth) + " "
	for (const vInfo of versionInfo) {
		headerRow2 += "│" + vInfo.freeze.padEnd(versionWidth)
	}
	headerRow2 += "│"
	console.log(headerRow2)

	// Print separator
	let separator = "├" + "─".repeat(scenarioWidth + 2)
	for (let i = 0; i < versions.length; i++) {
		separator += "┼" + "─".repeat(versionWidth)
	}
	separator += "┤"
	console.log(separator)

	// Print data rows (now 3+ lines per scenario depending on scenario name length)
	for (const scenario of scenarios) {
		const scenarioData = matrix[scenario] || {}

		// Format scenario name, potentially splitting on hyphens
		const scenarioParts = formatScenarioName(scenario, scenarioWidth)
		const maxLines = Math.max(3, scenarioParts.length) // At least 3 lines for data

		// Print all lines for this scenario
		for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
			let row = "│ "

			// Scenario column content
			if (lineIndex < scenarioParts.length) {
				row += scenarioParts[lineIndex].padEnd(scenarioWidth)
			} else {
				row += "".padEnd(scenarioWidth)
			}
			row += " "

			// Version columns content
			for (const version of versions) {
				let cellContent = ""

				if (lineIndex === 0) {
					// First line: absolute times
					const data = scenarioData[version]
					let timeStr = data ? formatTime(data.avgTime) : "N/A"
					if (timeStr.length > versionWidth) {
						timeStr = timeStr.substring(0, versionWidth - 1) + "…"
					}
					cellContent = timeStr
				} else if (lineIndex === 1) {
					// Second line: relative performance multipliers
					const relative = relativeData[scenario]?.[version]
					if (relative) {
						cellContent = formatMultiplier(relative)
					} else {
						cellContent = "N/A"
					}
					if (cellContent.length > versionWidth) {
						cellContent = cellContent.substring(0, versionWidth - 1) + "…"
					}
				} else if (lineIndex === 2) {
					// Third line: rankings
					const ranking = rankings[scenario]?.[version]
					if (ranking) {
						cellContent = `(${formatRanking(ranking)})`
					}
				}
				// Lines beyond 2 are empty for version columns

				row += "│" + cellContent.padEnd(versionWidth)
			}

			row += "│"
			console.log(row)
		}

		// Add separator between scenarios (except for last one)
		if (scenario !== scenarios[scenarios.length - 1]) {
			let rowSep = "├" + "─".repeat(scenarioWidth + 2)
			for (let i = 0; i < versions.length; i++) {
				rowSep += "┼" + "─".repeat(versionWidth)
			}
			rowSep += "┤"
			console.log(rowSep)
		}
	}

	// Print footer
	let footer = "└" + "─".repeat(scenarioWidth + 2)
	for (let i = 0; i < versions.length; i++) {
		footer += "┴" + "─".repeat(versionWidth)
	}
	footer += "┘"
	console.log(footer)

	console.log("\nNotes:")
	console.log("- f+ = freeze enabled, f- = freeze disabled")
	console.log("- Line 1: absolute execution time")
	console.log("- Line 2: relative performance multiplier")
	console.log("- Line 3: ranking (1st = fastest, 2nd = second fastest, etc.)")
	console.log("- 1.00x indicates the fastest version for that scenario")
}

// Performance improvement analysis between immer10Perf and immer10 (freeze: true)
function calculateImmer10PerfImprovement(matrix, scenarios) {
	const baselineKey = "immer10|f+"
	const improvedKey = "immer10Perf|f+"

	const improvements = []

	for (const scenario of scenarios) {
		const scenarioData = matrix[scenario] || {}
		const baselineData = scenarioData[baselineKey]
		const improvedData = scenarioData[improvedKey]

		if (baselineData && improvedData) {
			const baselineTime = baselineData.avgTime
			const improvedTime = improvedData.avgTime

			// Calculate percentage improvement: ((baseline - improved) / baseline) * 100
			// Positive = improvement, negative = regression
			const improvement = ((baselineTime - improvedTime) / baselineTime) * 100

			improvements.push({
				scenario,
				baselineTime,
				improvedTime,
				improvement
			})
		}
	}

	if (improvements.length === 0) {
		return null
	}

	const improvementValues = improvements.map(i => i.improvement)
	const minImprovement = Math.min(...improvementValues)
	const maxImprovement = Math.max(...improvementValues)
	const avgImprovement =
		improvementValues.reduce((sum, val) => sum + val, 0) /
		improvementValues.length

	return {
		improvements,
		stats: {
			min: minImprovement,
			max: maxImprovement,
			avg: avgImprovement,
			count: improvements.length
		}
	}
}

// Calculate overall version scores using geometric mean of relative performance
function calculateOverallVersionScores(relativeData, scenarios, versions) {
	const versionScores = []

	for (const version of versions) {
		const multipliers = []

		// Collect all relative performance multipliers for this version
		for (const scenario of scenarios) {
			const relative = relativeData[scenario]?.[version]
			if (relative && relative > 0) {
				multipliers.push(relative)
			}
		}

		if (multipliers.length === 0) continue

		// Calculate geometric mean: nth root of product of all values
		// For performance data, geometric mean is more appropriate than arithmetic mean
		const product = multipliers.reduce((prod, val) => prod * val, 1)
		const geometricMean = Math.pow(product, 1 / multipliers.length)

		versionScores.push({
			version,
			geometricMean,
			scenarioCount: multipliers.length
		})
	}

	// Sort by geometric mean (lower is better - closer to 1.0x means consistently fast)
	versionScores.sort((a, b) => a.geometricMean - b.geometricMean)

	// Add rankings
	versionScores.forEach((score, index) => {
		score.rank = index + 1
	})

	return versionScores
}

function printImmer10PerfComparison(improvementData) {
	console.log("\n")
	console.log("=".repeat(80))
	console.log("IMMER10PERF vs IMMER10 PERFORMANCE COMPARISON (freeze: true)")
	console.log("=".repeat(80))

	if (!improvementData) {
		console.log(
			"No comparable data found between immer10Perf and immer10 (freeze: true)"
		)
		return
	}

	const {stats, improvements} = improvementData

	console.log(`\nSummary Statistics (${stats.count} scenarios):`)
	console.log(
		`  Average Improvement: ${stats.avg >= 0 ? "+" : ""}${stats.avg.toFixed(
			1
		)}%`
	)
	console.log(
		`  Best Improvement:    ${stats.max >= 0 ? "+" : ""}${stats.max.toFixed(
			1
		)}%`
	)
	console.log(
		`  Worst Improvement:   ${stats.min >= 0 ? "+" : ""}${stats.min.toFixed(
			1
		)}%`
	)

	// Show per-scenario breakdown
	console.log("\nPer-Scenario Breakdown:")
	console.log(
		"┌─────────────────────┬──────────────┬──────────────┬─────────────┐"
	)
	console.log(
		"│ Scenario            │ immer10      │ immer10Perf  │ Improvement │"
	)
	console.log(
		"├─────────────────────┼──────────────┼──────────────┼─────────────┤"
	)

	// Sort by improvement (best first)
	const sortedImprovements = [...improvements].sort(
		(a, b) => b.improvement - a.improvement
	)

	for (const item of sortedImprovements) {
		const scenario = item.scenario.padEnd(19).substring(0, 19)
		const baseline = formatTime(item.baselineTime).padStart(12)
		const improved = formatTime(item.improvedTime).padStart(12)
		const improvement = `${
			item.improvement >= 0 ? "+" : ""
		}${item.improvement.toFixed(1)}%`.padStart(11)

		console.log(`│ ${scenario} │ ${baseline} │ ${improved} │ ${improvement} │`)
	}

	console.log(
		"└─────────────────────┴──────────────┴──────────────┴─────────────┘"
	)

	// Interpretation
	if (stats.avg > 0) {
		console.log(
			`\n✓ immer10Perf shows an average ${stats.avg.toFixed(
				1
			)}% performance improvement over immer10`
		)
	} else {
		console.log(
			`\n⚠ immer10Perf shows an average ${Math.abs(stats.avg).toFixed(
				1
			)}% performance regression vs immer10`
		)
	}
}

function printOverallVersionRankings(versionScores) {
	console.log("\n")
	console.log("=".repeat(80))
	console.log(
		"OVERALL VERSION RANKINGS (Geometric Mean of Relative Performance)"
	)
	console.log("=".repeat(80))

	if (versionScores.length === 0) {
		console.log("No version data available for overall rankings.")
		return
	}

	console.log(
		"\nMethodology: Lower geometric mean = better overall performance"
	)
	console.log(
		"(Geometric mean is standard for benchmarking as it handles multiplicative performance differences)"
	)

	console.log("\n┌──────┬─────────────────────┬─────────────────┬───────────┐")
	console.log("│ Rank │ Version             │ Geometric Mean  │ Scenarios │")
	console.log("├──────┼─────────────────────┼─────────────────┼───────────┤")

	for (const score of versionScores) {
		const [versionName, freezeIndicator] = score.version.split("|")
		const shortName = shortenVersionName(versionName)
		const displayName = `${shortName} (${freezeIndicator})`
			.padEnd(19)
			.substring(0, 19)
		const rank = score.rank.toString().padStart(4)
		const geoMean = `${score.geometricMean.toFixed(2)}x`.padStart(15)
		const scenarios = score.scenarioCount.toString().padStart(9)

		console.log(`│ ${rank} │ ${displayName} │ ${geoMean} │ ${scenarios} │`)
	}

	console.log("└──────┴─────────────────────┴─────────────────┴───────────┘")

	// Highlight top performers
	if (versionScores.length >= 3) {
		console.log("\nTop Overall Performers:")
		for (let i = 0; i < Math.min(10, versionScores.length); i++) {
			const score = versionScores[i]
			const [versionName, freezeIndicator] = score.version.split("|")
			const shortName = shortenVersionName(versionName)
			console.log(
				`  ${i +
					1}. ${shortName} (${freezeIndicator}) - ${score.geometricMean.toFixed(
					2
				)}x average`
			)
		}
	}
}

function printBenchmarkSummaryTable(benchmarks) {
	try {
		const data = extractBenchmarkData(benchmarks)
		if (data.length === 0) {
			console.log("\nNo valid benchmark data found for summary table.")
			return
		}

		const {matrix, scenarios, versions} = organizeBenchmarkMatrix(data)
		const {relativeData, rankings} = calculateRelativePerformanceAndRankings(
			matrix,
			scenarios,
			versions
		)

		// Print main summary table
		printSummaryTable(matrix, scenarios, versions, relativeData, rankings)

		// Print immer10Perf vs immer10 comparison
		const improvementData = calculateImmer10PerfImprovement(matrix, scenarios)
		printImmer10PerfComparison(improvementData)

		// Print overall version rankings
		const versionScores = calculateOverallVersionScores(
			relativeData,
			scenarios,
			versions
		)
		printOverallVersionRankings(versionScores)
	} catch (error) {
		console.error("\nError generating summary table:", error.message)
	}
}

async function main() {
	createBenchmarks()
	const results = await run()

	// Generate and print summary table
	printBenchmarkSummaryTable(results.benchmarks)

	process.exit(0)
}

main()
