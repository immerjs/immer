import {assert, _} from "spec.ts"
import produce, {
	produce as produce2,
	applyPatches,
	Patch,
	nothing,
	Draft,
	Immutable
} from "../src/"
import * as redux from "redux"

export interface State {
	counter: number
}

export interface Action {
	type: string
	payload: number
}

export const initialState: State = {
	counter: 0
}

/// =============== Actions

export function addToCounter(addNumber: number) {
	return {
		type: "ADD_TO_COUNTER",
		payload: addNumber
	}
}

export function subFromCounter(subNumber: number) {
	return {
		type: "SUB_FROM_COUNTER",
		payload: subNumber
	}
}

export const reduceCounterProducer = (
	state: State = initialState,
	action: Action
) =>
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

export const reduceCounterCurriedProducer = produce(
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

export const reduce = redux.combineReducers({
	counterReducer: reduceCounterProducer
})

export const curredReduce = redux.combineReducers({
	counterReducer: reduceCounterCurriedProducer
})

// reducing the current state to get the next state!
// console.log(reduce(initialState, addToCounter(12));

// ================ store

export const store = redux.createStore(reduce)
export const curriedStore = redux.createStore(curredReduce)

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
