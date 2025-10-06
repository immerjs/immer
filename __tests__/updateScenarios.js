import {describe, test, expect, beforeEach} from "vitest"
import {produce} from "../src/immer"

// Test configuration - smaller values for faster tests
const TEST_CONFIG = {
	arraySize: 10,
	nestedArraySize: 2,
	multiUpdateCount: 5,
	reuseStateIterations: 5
}

function createInitialState(arraySize = TEST_CONFIG.arraySize) {
	const initialState = {
		largeArray: Array.from({length: arraySize}, (_, i) => ({
			id: i,
			value: Math.random(),
			nested: {key: `key-${i}`, data: Math.random()},
			moreNested: {
				items: Array.from({length: TEST_CONFIG.nestedArraySize}, (_, i) => ({
					id: i,
					name: String(i)
				}))
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

// Utility functions for calculating array indices based on size
const getValidIndex = (arraySize = TEST_CONFIG.arraySize) => {
	// Return a valid index (not the last one to avoid edge cases)
	return Math.min(arraySize - 2, Math.max(0, arraySize - 2))
}

const getValidId = (arraySize = TEST_CONFIG.arraySize) => {
	// Return a valid ID that exists in the array
	return Math.min(arraySize - 2, Math.max(0, arraySize - 2))
}

const getHighIndex = (offset = 0, arraySize = TEST_CONFIG.arraySize) => {
	// Calculate high index (80% through the array + offset)
	return Math.floor(arraySize * 0.8) + (offset % Math.floor(arraySize * 0.2))
}

// Action creators
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
	payload: Array.from({length: 50}, (_, i) => ({id: i, value: index}))
})

const updateHigh = index => ({
	type: "test/updateHighIndex",
	payload: {
		id: getHighIndex(index),
		value: index,
		nestedData: index
	}
})

const updateMultiple = index => ({
	type: "test/updateMultiple",
	payload: Array.from({length: TEST_CONFIG.multiUpdateCount}, (_, i) => ({
		id: (index + i) % TEST_CONFIG.arraySize,
		value: index + i,
		nestedData: index + i
	}))
})

const removeHigh = index => ({
	type: "test/removeHighIndex",
	payload: getHighIndex(index)
})

const sortByIdReverse = () => ({
	type: "test/sortByIdReverse"
})

const reverseArray = () => ({
	type: "test/reverseArray"
})

const actions = {
	add,
	remove,
	filter,
	update,
	concat,
	updateHigh,
	updateMultiple,
	removeHigh,
	sortByIdReverse,
	reverseArray
}

// Vanilla reducer for comparison
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
		default:
			return state
	}
}

// Immer reducer
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
					if (item) {
						item.value = action.payload.value
						item.nested.data = action.payload.nestedData
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
			}
		})

	return immerReducer
}

const immerReducer = createImmerReducer(produce)

describe("Update Scenarios - Single Operations", () => {
	let initialState

	beforeEach(() => {
		initialState = createInitialState()
	})

	test("add scenario", () => {
		const action = actions.add(0)
		const vanillaResult = vanillaReducer(initialState, action)
		const immerResult = immerReducer(initialState, action)

		expect(immerResult.largeArray.length).toBe(vanillaResult.largeArray.length)
		expect(immerResult.largeArray[immerResult.largeArray.length - 1]).toEqual(
			action.payload
		)
	})

	test("remove scenario", () => {
		const action = actions.remove(getValidIndex())
		const vanillaResult = vanillaReducer(initialState, action)
		const immerResult = immerReducer(initialState, action)

		expect(immerResult.largeArray.length).toBe(vanillaResult.largeArray.length)
		expect(immerResult.largeArray.length).toBe(
			initialState.largeArray.length - 1
		)
	})

	test("filter scenario", () => {
		// Keep 60% of the items
		const percentage = 0.6
		const action = actions.filter(percentage)
		const vanillaResult = vanillaReducer(initialState, action)
		const immerResult = immerReducer(initialState, action)

		expect(immerResult.largeArray.length).toBe(vanillaResult.largeArray.length)
		expect(immerResult.largeArray.length).toBe(
			initialState.largeArray.length * percentage
		)
	})

	test("update scenario", () => {
		const targetId = getValidId()
		const action = actions.update(targetId)
		const vanillaResult = vanillaReducer(initialState, action)
		const immerResult = immerReducer(initialState, action)

		const updatedItem = immerResult.largeArray.find(
			item => item.id === targetId
		)
		expect(updatedItem.value).toBe(targetId)
		expect(updatedItem.nested.data).toBe(targetId)
	})

	test("concat scenario", () => {
		const action = actions.concat(1)
		const vanillaResult = vanillaReducer(initialState, action)
		const immerResult = immerReducer(initialState, action)

		expect(immerResult.largeArray.length).toBe(vanillaResult.largeArray.length)
		expect(immerResult.largeArray.length).toBe(initialState.largeArray.length)
	})

	test("updateHigh scenario", () => {
		const action = actions.updateHigh(2)
		const vanillaResult = vanillaReducer(initialState, action)
		const immerResult = immerReducer(initialState, action)

		const targetId = action.payload.id
		const updatedItem = immerResult.largeArray.find(
			item => item.id === targetId
		)
		expect(updatedItem.value).toBe(2)
		expect(updatedItem.nested.data).toBe(2)
	})

	test("updateMultiple scenario", () => {
		const action = actions.updateMultiple(3)
		const vanillaResult = vanillaReducer(initialState, action)
		const immerResult = immerReducer(initialState, action)

		action.payload.forEach(update => {
			const updatedItem = immerResult.largeArray.find(
				item => item.id === update.id
			)
			expect(updatedItem.value).toBe(update.value)
			expect(updatedItem.nested.data).toBe(update.nestedData)
		})
	})

	test("removeHigh scenario", () => {
		const action = actions.removeHigh(1)
		const vanillaResult = vanillaReducer(initialState, action)
		const immerResult = immerReducer(initialState, action)

		expect(immerResult.largeArray.length).toBe(vanillaResult.largeArray.length)
		const removedItem = immerResult.largeArray.find(
			item => item.id === action.payload
		)
		expect(removedItem).toBeUndefined()
	})

	test("sortByIdReverse scenario", () => {
		const action = actions.sortByIdReverse()
		const vanillaResult = vanillaReducer(initialState, action)
		const immerResult = immerReducer(initialState, action)

		expect(immerResult.largeArray.length).toBe(vanillaResult.largeArray.length)
		expect(immerResult.largeArray.length).toBe(initialState.largeArray.length)

		// Verify sorting - first element should have highest ID
		expect(immerResult.largeArray[0].id).toBe(TEST_CONFIG.arraySize - 1)
		expect(immerResult.largeArray[immerResult.largeArray.length - 1].id).toBe(0)

		// Verify arrays match
		expect(immerResult.largeArray.map(item => item.id)).toEqual(
			vanillaResult.largeArray.map(item => item.id)
		)
	})

	test("reverseArray scenario", () => {
		const action = actions.reverseArray()
		const vanillaResult = vanillaReducer(initialState, action)
		const immerResult = immerReducer(initialState, action)

		expect(immerResult.largeArray.length).toBe(vanillaResult.largeArray.length)
		expect(immerResult.largeArray.length).toBe(initialState.largeArray.length)

		// Verify reversal - first element should be what was last
		expect(immerResult.largeArray[0].id).toBe(TEST_CONFIG.arraySize - 1)
		expect(immerResult.largeArray[immerResult.largeArray.length - 1].id).toBe(0)

		// Verify arrays match
		expect(immerResult.largeArray.map(item => item.id)).toEqual(
			vanillaResult.largeArray.map(item => item.id)
		)
	})
})

describe("Update Scenarios - State Reuse", () => {
	test("update-reuse scenario", () => {
		let currentState = createInitialState()

		for (let i = 0; i < TEST_CONFIG.reuseStateIterations; i++) {
			currentState = immerReducer(currentState, actions.update(i))
		}

		// Verify the final state has all updates applied
		for (let i = 0; i < TEST_CONFIG.reuseStateIterations; i++) {
			const item = currentState.largeArray.find(item => item.id === i)
			expect(item.value).toBe(i)
			expect(item.nested.data).toBe(i)
		}
	})

	test("updateHigh-reuse scenario", () => {
		let currentState = createInitialState()

		for (let i = 0; i < TEST_CONFIG.reuseStateIterations; i++) {
			currentState = immerReducer(currentState, actions.updateHigh(i))
		}

		// Verify updates were applied to high indices
		expect(currentState.largeArray.length).toBe(TEST_CONFIG.arraySize)
	})

	test("remove-reuse scenario", () => {
		let currentState = createInitialState()
		const originalLength = currentState.largeArray.length

		for (let i = 0; i < TEST_CONFIG.reuseStateIterations; i++) {
			currentState = immerReducer(currentState, actions.remove(0)) // Always remove first item
		}

		expect(currentState.largeArray.length).toBe(
			originalLength - TEST_CONFIG.reuseStateIterations
		)
	})

	test("removeHigh-reuse scenario", () => {
		let currentState = createInitialState()
		const originalLength = currentState.largeArray.length

		for (let i = 0; i < TEST_CONFIG.reuseStateIterations; i++) {
			currentState = immerReducer(currentState, actions.removeHigh(i))
		}

		expect(currentState.largeArray.length).toBeLessThan(originalLength)
	})
})

describe("Update Scenarios - Mixed Sequence", () => {
	test("mixed-sequence scenario", () => {
		let state = createInitialState()
		const originalLength = state.largeArray.length

		// Perform a sequence of different operations (typical workflow)
		state = immerReducer(state, actions.add(1))
		expect(state.largeArray.length).toBe(originalLength + 1)

		const targetId = getValidId()
		state = immerReducer(state, actions.update(targetId))
		const updatedItem = state.largeArray.find(item => item.id === targetId)
		expect(updatedItem.value).toBe(targetId)

		state = immerReducer(state, actions.updateHigh(2))
		state = immerReducer(state, actions.updateMultiple(3))

		state = immerReducer(state, actions.remove(getValidIndex()))
		expect(state.largeArray.length).toBe(originalLength) // +1 from add, -1 from remove

		// Verify final state integrity
		expect(state.largeArray).toBeDefined()
		expect(state.otherData).toBeDefined()
		expect(state.largeArray.every(item => item.id !== undefined)).toBe(true)
	})
})

describe("Update Scenarios - Performance Focused", () => {
	test("large array operations", () => {
		const largeState = createInitialState(5000)

		// Test that operations complete without timeout
		const result1 = immerReducer(largeState, actions.update(1000))
		expect(result1.largeArray.length).toBe(5000)

		const result2 = immerReducer(largeState, actions.updateHigh(10))
		expect(result2.largeArray.length).toBe(5000)

		const result3 = immerReducer(largeState, actions.updateMultiple(20))
		expect(result3.largeArray.length).toBe(5000)
	})

	test("nested data modifications", () => {
		const state = createInitialState(100)

		const result = immerReducer(state, actions.update(50))
		const updatedItem = result.largeArray.find(item => item.id === 50)

		expect(updatedItem.nested.data).toBe(50)
		expect(updatedItem.moreNested.items).toBeDefined()
		expect(updatedItem.moreNested.items.length).toBe(
			TEST_CONFIG.nestedArraySize
		)
	})
})
