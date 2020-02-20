"use strict"
import produce, {
	applyPatches,
	immerable,
	produceWithPatches,
	enableAllPlugins,
	setAutoFreeze
} from "../src/immer"

enableAllPlugins()

describe("readme example", () => {
	it("works", () => {
		const baseState = [
			{
				todo: "Learn typescript",
				done: true
			},
			{
				todo: "Try immer",
				done: false
			}
		]

		const nextState = produce(baseState, draft => {
			draft.push({todo: "Tweet about it"})
			draft[1].done = true
		})

		// the new item is only added to the next state,
		// base state is unmodified
		expect(baseState.length).toBe(2)
		expect(nextState.length).toBe(3)

		// same for the changed 'done' prop
		expect(baseState[1].done).toBe(false)
		expect(nextState[1].done).toBe(true)

		// unchanged data is structurally shared
		expect(nextState[0]).toBe(baseState[0])
		// changed data not (dûh)
		expect(nextState[1]).not.toBe(baseState[1])
	})

	it("patches", () => {
		let state = {
			name: "Micheal",
			age: 32
		}

		// Let's assume the user is in a wizard, and we don't know whether
		// his changes should be updated
		let fork = state
		// all the changes the user made in the wizard
		let changes = []
		// all the inverse patches
		let inverseChanges = []

		fork = produce(
			fork,
			draft => {
				draft.age = 33
			},
			// The third argument to produce is a callback to which the patches will be fed
			(patches, inversePatches) => {
				changes.push(...patches)
				inverseChanges.push(...inversePatches)
			}
		)

		// In the mean time, our original state is updated as well, as changes come in from the server
		state = produce(state, draft => {
			draft.name = "Michel"
		})

		// When the wizard finishes (successfully) we can replay the changes made in the fork onto the *new* state!
		state = applyPatches(state, changes)

		// state now contains the changes from both code paths!
		expect(state).toEqual({
			name: "Michel",
			age: 33
		})

		// Even after finishing the wizard, the user might change his mind...
		state = applyPatches(state, inverseChanges)
		expect(state).toEqual({
			name: "Michel",
			age: 32
		})
	})

	it("can update set", () => {
		const state = {
			title: "hello",
			tokenSet: new Set()
		}

		const nextState = produce(state, draft => {
			draft.title = draft.title.toUpperCase()
			draft.tokenSet.add("c1342")
		})

		expect(state).toEqual({title: "hello", tokenSet: new Set()})
		expect(nextState).toEqual({
			title: "HELLO",
			tokenSet: new Set(["c1342"])
		})
	})

	it("can deep update map", () => {
		const state = {
			users: new Map([["michel", {name: "miche", age: 27}]])
		}

		const nextState = produce(state, draft => {
			draft.users.get("michel").name = "michel"
		})

		expect(state).toEqual({
			users: new Map([["michel", {name: "miche", age: 27}]])
		})
		expect(nextState).toEqual({
			users: new Map([["michel", {name: "michel", age: 27}]])
		})
	})

	it("supports immerable", () => {
		class Clock {
			constructor(hours = 0, minutes = 0) {
				this.hours = hours
				this.minutes = minutes
			}

			increment(hours, minutes = 0) {
				return produce(this, d => {
					d.hours += hours
					d.minutes += minutes
				})
			}

			toString() {
				return `${("" + this.hours).padStart(2, 0)}:${(
					"" + this.minutes
				).padStart(2, 0)}`
			}
		}
		Clock[immerable] = true

		const midnight = new Clock()
		const lunch = midnight.increment(12, 30)

		expect(midnight).not.toBe(lunch)
		expect(lunch).toBeInstanceOf(Clock)
		expect(midnight.toString()).toBe("00:00")
		expect(lunch.toString()).toBe("12:30")

		const diner = lunch.increment(6)

		expect(diner).not.toBe(lunch)
		expect(lunch).toBeInstanceOf(Clock)
		expect(diner.toString()).toBe("18:30")
	})

	test("produceWithPatches", () => {
		const result = produceWithPatches(
			{
				age: 33
			},
			draft => {
				draft.age++
			}
		)
		expect(result).toEqual([
			{
				age: 34
			},
			[
				{
					op: "replace",
					path: ["age"],
					value: 34
				}
			],
			[
				{
					op: "replace",
					path: ["age"],
					value: 33
				}
			]
		])
	})
})

test("Producers can update Maps", () => {
	setAutoFreeze(true)
	const usersById_v1 = new Map()

	const usersById_v2 = produce(usersById_v1, draft => {
		// Modifying a map results in a new map
		draft.set("michel", {name: "Michel Weststrate", country: "NL"})
	})

	const usersById_v3 = produce(usersById_v2, draft => {
		// Making a change deep inside a map, results in a new map as well!
		draft.get("michel").country = "UK"
		debugger
	})

	// We got a new map each time!
	expect(usersById_v2).not.toBe(usersById_v1)
	expect(usersById_v3).not.toBe(usersById_v2)
	// With different content obviously
	expect(usersById_v1).toMatchInlineSnapshot(`Map {}`)
	expect(usersById_v2).toMatchInlineSnapshot(`
		Map {
		  "michel" => Object {
		    "country": "NL",
		    "name": "Michel Weststrate",
		  },
		}
	`)
	expect(usersById_v3).toMatchInlineSnapshot(`
		Map {
		  "michel" => Object {
		    "country": "UK",
		    "name": "Michel Weststrate",
		  },
		}
	`)
	// The old one was never modified
	expect(usersById_v1.size).toBe(0)
	// And trying to change a Map outside a producers is going to: NO!
	expect(() => usersById_v3.clear()).toThrowErrorMatchingSnapshot()
})
