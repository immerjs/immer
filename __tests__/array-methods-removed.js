import {
	Immer,
	enableArrayMethods,
	enablePatches,
	freeze,
	isDraft
} from "../src/immer"
import {clearPlugin, PluginArrayMethods} from "../src/internal"

enablePatches()

for (const enabled of [false, true]) {
	for (const autoFreeze of [false, true]) {
		describe(`removed array values: plugin=${enabled}, autoFreeze=${autoFreeze}`, () => {
			beforeEach(() => {
				if (enabled) enableArrayMethods()
				else clearPlugin(PluginArrayMethods)
			})
			afterEach(() => clearPlugin(PluginArrayMethods))

			for (const method of ["pop", "shift", "splice"]) {
				test(`${method} returns a draft that can move between arrays`, () => {
					for (const frozen of [false, true]) {
						const immer = new Immer({autoFreeze})
						const base = {todo: [{done: false, details: {count: 0}}], done: []}
						if (frozen) freeze(base, true)
						let patches, inverse
						const next = immer.produce(
							base,
							draft => {
								const item =
									method === "splice"
										? draft.todo.splice(0, 1)[0]
										: draft.todo[method]()
								expect(isDraft(item)).toBe(true)
								draft.done.push(item)
								item.done = true
								item.details.count++
							},
							(p, i) => {
								patches = p
								inverse = i
							}
						)
						expect(base.todo[0]).toEqual({done: false, details: {count: 0}})
						expect(next).toEqual({
							todo: [],
							done: [{done: true, details: {count: 1}}]
						})
						expect(next.done[0]).not.toBe(base.todo[0])
						expect(next.done[0].details).not.toBe(base.todo[0].details)
						expect(immer.applyPatches(base, patches)).toEqual(next)
						expect(immer.applyPatches(next, inverse)).toEqual(base)
					}
				})
			}

			test("preserves holes when splicing sparse arrays", () => {
				const immer = new Immer({autoFreeze})
				const base = {items: [, , {done: false}], done: []}
				const next = immer.produce(base, draft => {
					const removed = draft.items.splice(0, 3)
					expect(0 in removed).toBe(false)
					expect(1 in removed).toBe(false)
					draft.done.push(removed[2])
					removed[2].done = true
				})
				expect(base.items[2].done).toBe(false)
				expect(next.done[0].done).toBe(true)
			})

			test("reuses a child draft that was read before removal", () => {
				const immer = new Immer({autoFreeze})
				const base = {items: [{done: false}], done: []}
				const next = immer.produce(base, draft => {
					const before = draft.items[0]
					const removed = draft.items.pop()
					expect(removed).toBe(before)
					draft.done.push(removed)
					removed.done = true
				})
				expect(base.items[0].done).toBe(false)
				expect(next.done[0].done).toBe(true)
			})

			test("does not reread getters outside the removed position", () => {
				const immer = new Immer({autoFreeze})
				let reads = 0
				const items = [{done: false}, {done: false}]
				Object.defineProperty(items, 0, {
					get() {
						if (++reads > 1) throw new Error("getter read twice")
						return {done: false}
					},
					enumerable: true,
					configurable: true
				})
				const next = immer.produce({items, done: []}, draft => {
					const item = draft.items.pop()
					draft.done.push(item)
					item.done = true
				})
				expect(reads).toBe(1)
				expect(items[1].done).toBe(false)
				expect(next.done[0].done).toBe(true)
			})

			test("preserves empty no-op return values and structural sharing", () => {
				const immer = new Immer({autoFreeze})
				const base = {items: []}
				const next = immer.produce(base, draft => {
					expect(draft.items.pop()).toBeUndefined()
					expect(draft.items.shift()).toBeUndefined()
					expect(draft.items.splice(0, 0)).toEqual([])
				})
				expect(next).toBe(base)
			})

			test("keeps newly inserted objects undrafted when removed", () => {
				const immer = new Immer({autoFreeze})
				for (const method of ["pop", "shift", "splice"]) {
					const external = {done: false}
					immer.produce({items: []}, draft => {
						draft.items.push(external)
						const item =
							method === "splice"
								? draft.items.splice(0, 1)[0]
								: draft.items[method]()
						expect(item).toBe(external)
						expect(isDraft(item)).toBe(false)
					})
				}
			})
		})
	}
}
