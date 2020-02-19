import {assert, _} from "spec.ts"
import produce, {
	produce as produce2,
	applyPatches,
	Patch,
	nothing,
	Draft,
	Immutable,
	enableES5
} from "../src/immer"
import * as redux from "redux"

enableES5()

interface State {
	counter: number
}

interface Action {
	type: string
	payload: number
}

const initialState: State = {
	counter: 0
}

/// =============== Actions

function addToCounter(addNumber: number) {
	return {
		type: "ADD_TO_COUNTER",
		payload: addNumber
	}
}

function subFromCounter(subNumber: number) {
	return {
		type: "SUB_FROM_COUNTER",
		payload: subNumber
	}
}

const reduceCounterProducer = (state: State = initialState, action: Action) =>
	produce(state, draftState => {
		switch (action.type) {
			case "ADD_TO_COUNTER":
				draftState.counter += action.payload
				break
			case "SUB_FROM_COUNTER":
				draftState.counter -= action.payload
				break
		}
	})

const reduceCounterCurriedProducer = produce(
	(draftState: Draft<State>, action: Action) => {
		switch (action.type) {
			case "ADD_TO_COUNTER":
				draftState.counter += action.payload
				break
			case "SUB_FROM_COUNTER":
				draftState.counter -= action.payload
				break
		}
	},
	initialState
)

/// =============== Reducers

const reduce = redux.combineReducers({
	counterReducer: reduceCounterProducer
})

const curredReduce = redux.combineReducers({
	counterReducer: reduceCounterCurriedProducer
})

// reducing the current state to get the next state!
// console.log(reduce(initialState, addToCounter(12));

// ================ store

const store = redux.createStore(reduce)
const curriedStore = redux.createStore(curredReduce)

it("#470 works with Redux combine reducers", () => {
	assert(
		store.getState().counterReducer,
		_ as {
			counter: number
		}
	)
	assert(
		curriedStore.getState().counterReducer,
		_ as {
			readonly counter: number
		}
	)
})
