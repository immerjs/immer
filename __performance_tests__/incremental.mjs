"use strict"
import {measure} from "./measure.mjs"
import {produce, setAutoFreeze} from "../dist/immer.mjs"
import cloneDeep from "lodash.clonedeep"
import Immutable from "immutable"

console.log("\n# incremental - lot of small incremental changes\n")

function createTestObject() {
	return {
		a: 1,
		b: "Some data here"
	}
}

const MAX = 1000
const baseState = {
	ids: [],
	map: Object.create(null)
}

let immutableJsBaseState

immutableJsBaseState = {
	ids: Immutable.List(),
	map: Immutable.Map()
}

measure(
	"just mutate",
	() => cloneDeep(baseState),
	draft => {
		for (let i = 0; i < MAX; i++) {
			draft.ids.push(i)
			draft.map[i] = createTestObject()
		}
	}
)

measure(
	"handcrafted reducer",
	() => cloneDeep(baseState),
	state => {
		for (let i = 0; i < MAX; i++) {
			state = {
				ids: [...state.ids, i],
				map: {
					...state.map,
					[i]: createTestObject()
				}
			}
		}
	}
)

measure(
	"immutableJS",
	() => immutableJsBaseState,
	state => {
		for (let i = 0; i < MAX; i++) {
			state = {
				ids: state.ids.push(i),
				map: state.map.set(i, createTestObject())
			}
		}
	}
)

measure(
	"immer",
	() => {
		setAutoFreeze(false)
		return baseState
	},
	state => {
		for (let i = 0; i < MAX; i++) {
			state = produce(state, draft => {
				draft.ids.push(i)
				draft.map[i] = createTestObject()
			})
		}
	}
)

measure(
	"immer - single produce",
	() => {
		setAutoFreeze(false)
		return baseState
	},
	state => {
		produce(state, draft => {
			for (let i = 0; i < MAX; i++) {
				draft.ids.push(i)
				draft.map[i] = createTestObject()
			}
		})
	}
)
