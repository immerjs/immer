"use strict"
import {measure} from "./measure"
import produce, {
	setAutoFreeze,
	setUseProxies,
	enableAllPlugins
} from "../dist/immer.cjs.production.min.js"
import cloneDeep from "lodash.clonedeep"
import * as Immutable from "immutable"

enableAllPlugins()

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
	"immer (proxy)",
	() => {
		setUseProxies(true)
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
	"immer (es5)",
	() => {
		setUseProxies(false)
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
	"immer (proxy) - single produce",
	() => {
		setUseProxies(true)
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

measure(
	"immer (es5) - single produce",
	() => {
		setUseProxies(false)
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
