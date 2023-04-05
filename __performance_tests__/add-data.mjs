"use strict"

import {measure} from "./measure.mjs"
import {produce, setAutoFreeze} from "../dist/immer.mjs"
import cloneDeep from "lodash.clonedeep"
import immutable from "immutable"
const {fromJS} = immutable
import Seamless from "seamless-immutable"
import deepFreeze from "deep-freeze"

console.log("\n# add-data - loading large set of data\n")

import dataSet from "./data.json"  assert { type: "json" }

const baseState = {
	data: null
}
const frozenBazeState = deepFreeze(cloneDeep(baseState))
const immutableJsBaseState = fromJS(baseState)
const seamlessBaseState = Seamless.from(baseState)

const MAX = 10000

measure(
	"just mutate",
	() => ({draft: cloneDeep(baseState)}),
	({draft}) => {
		draft.data = dataSet
	}
)

measure(
	"just mutate, freeze",
	() => ({draft: cloneDeep(baseState)}),
	({draft}) => {
		draft.data = dataSet
		deepFreeze(draft)
	}
)

measure("handcrafted reducer (no freeze)", () => {
	const nextState = {
		...baseState,
		data: dataSet
	}
})

measure("handcrafted reducer (with freeze)", () => {
	const nextState = deepFreeze({
		...baseState,
		data: dataSet
	})
})

measure("immutableJS", () => {
	let state = immutableJsBaseState.withMutations(state => {
		state.setIn(["data"], fromJS(dataSet))
	})
})

measure("immutableJS + toJS", () => {
	let state = immutableJsBaseState
		.withMutations(state => {
			state.setIn(["data"], fromJS(dataSet))
		})
		.toJS()
})

measure("seamless-immutable", () => {
	seamlessBaseState.set("data", dataSet)
})

measure("seamless-immutable + asMutable", () => {
	seamlessBaseState.set("data", dataSet).asMutable({deep: true})
})

measure("immer - without autofreeze * " + MAX, () => {
	setAutoFreeze(false)
	for (let i = 0; i < MAX; i++)
		produce(baseState, draft => {
			draft.data = dataSet
		})
})

measure("immer - with autofreeze * " + MAX, () => {
	setAutoFreeze(true)
	for (let i = 0; i < MAX; i++)
		produce(frozenBazeState, draft => {
			draft.data = dataSet
		})
})
