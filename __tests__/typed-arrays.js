import produce, {enableAllPlugins, produceWithPatches} from "../src/immer"

describe("typed arrays", () => {
	beforeAll(() => {
		enableAllPlugins()
	})

	it("should create a copy on write", () => {
		const baseState = {
			data: new Uint16Array(3)
		}

		const nextState = produce(baseState, draftState => {
			draftState.data.fill(1)
			draftState.data[1] = 5
		})

		expect(nextState).toEqual({
			data: new Uint16Array([1, 5, 1])
		})
		expect(baseState.data).toEqual(new Uint16Array(3))
	})

	it("should create one copy of the same underlying ArrayBuffer with multiple views", () => {
		const arrayBuffer = new ArrayBuffer(8)
		const baseState = {
			uint16: new Uint16Array(arrayBuffer),
			float32: new Float32Array(arrayBuffer)
		}

		const nextState = produce(baseState, draftState => {
			draftState.uint16[0] = 1
			draftState.uint16[1] = 2
			draftState.float32[1] = 3
		})

		expect(nextState.uint16.buffer).toBe(nextState.float32.buffer)
		expect(nextState.uint16.slice(0, 2)).toEqual(new Uint16Array([1, 2]))
		expect(nextState.float32.slice(1)).toEqual(new Float32Array([3]))
		expect(new Uint8Array(arrayBuffer)).toEqual(new Uint8Array(8))
	})

	it("should not copy arrays when performing non-mutating operations", () => {
		const baseState = {
			data: new Uint16Array([1, 2]),
			result: undefined
		}

		const nextState = produce(baseState, draftState => {
			draftState.result = draftState.data.map(x => x + 1)
		})

		expect(nextState).toEqual({
			data: new Uint16Array([1, 2]),
			result: new Uint16Array([2, 3])
		})
		expect(nextState.data).toBe(baseState.data)
	})

	it("should use previously modified values when reading from draft", () => {
		const baseState = {
			data: new Uint16Array(2)
		}

		const nextState = produce(baseState, draftState => {
			draftState.data[0] = 1
			draftState.data[1] = draftState.data[0]
		})

		expect(nextState).toEqual({
			data: new Uint16Array([1, 1])
		})
	})

	it("should return empty patches", () => {
		const baseState = new Uint16Array(4)

		const [nextState, patches] = produceWithPatches(baseState, draftState => {
			draftState[0] = 50
			draftState[1] = 20
		})

		expect(nextState).toEqual(new Uint16Array([50, 20, 0, 0]))
		expect(patches).toEqual([])
	})

	it("should work when using a slice of an ArrayBuffer", () => {
		const arrayBuffer = new ArrayBuffer(8)
		const baseState = {
			data: new Uint16Array(arrayBuffer, 2, 2)
		}

		const nextState = produce(baseState, draftState => {
			draftState.data[0] = 1
			draftState.data[1] = 2
		})

		expect(nextState).toEqual({
			data: new Uint16Array([1, 2])
		})
		expect(new Uint8Array(arrayBuffer)).toEqual(new Uint8Array(8))
	})

	it("should allow modifying the internal ArrayBuffer without copying", () => {
		const baseState = {
			data: new Uint16Array(1)
		}

		const nextState = produce(baseState, draftState => {
			new Uint16Array(draftState.data.buffer)[0] = 50
		})

		expect(nextState).toEqual({
			data: new Uint16Array([50])
		})
		expect(new Uint8Array(baseState.data)).toEqual(new Uint8Array([50]))
	})

	it("should allow passing a typed array immediately to produce", () => {
		const baseState = new Uint16Array(1)

		const nextState = produce(baseState, draftState => {
			draftState[0] = 50
		})

		expect(nextState).toEqual(new Uint16Array([50]))
		expect(baseState).toEqual(new Uint16Array([0]))
	})

	it("should contain correct TypedArray properties in the draft", () => {
		expect.hasAssertions()
		const baseState = new Uint16Array(1)

		produce(baseState, draftState => {
			expect(draftState.BYTES_PER_ELEMENT).toBe(Uint16Array.BYTES_PER_ELEMENT)
			expect(draftState.buffer).toBe(baseState.buffer)
			expect(draftState.byteLength).toBe(baseState.byteLength)
			expect(draftState.byteOffset).toBe(baseState.byteOffset)
			expect(draftState.length).toBe(baseState.length)
		})
	})

	it("should have a draft that has the same prototype as the target", () => {
		expect.hasAssertions()

		const baseState = new Uint16Array(1)

		produce(baseState, draftState => {
			expect(draftState instanceof Uint16Array).toBe(true)
		})
	})

	it("should not be an ArrayBuffer view due to spec behavior", () => {
		expect.hasAssertions()

		const baseState = new Uint16Array(1)

		produce(baseState, draftState => {
			// Proxies for TypedArrays do not pass `ArrayBuffer.isView`
			expect(ArrayBuffer.isView(draftState)).toBe(false)
		})
	})

	it("should have a draft with the same own properties", () => {
		expect.hasAssertions()

		const baseState = new Uint16Array(5)

		produce(baseState, draftState => {
			expect(Object.keys(draftState)).toEqual(Object.keys(baseState))
		})
	})

	it("should behave correctly with nested produce calls", () => {
		const baseState = new Uint16Array(3)

		const nextState = produce(baseState, draftState => {
			return produce(draftState, secondLevelDraft => {
				secondLevelDraft[1] = 2
			})
		})

		expect(nextState).toEqual(new Uint16Array([0, 2, 0]))
	})
})
