import {Immer, enableMapSet} from "../src/immer"
import {inspect} from "util"
import * as v8 from "v8"

// Implementation note: TypeScript says ES5 doesn't support iterating directly over a Set so I've used Array.from().
// If the project is moved to a later JS feature set, we can drop the Array.from() and do `for (const value of ref)` instead.

test("modified circular object", () => {
	const immer = new Immer({allowMultiRefs: true})
	const base = {a: 1, b: null} as any
	base.b = base

	for (const env of ["production", "development", "testing"]) {
		process.env.NODE_ENV = env
		expect(() => {
			const next = immer.produce(base, (draft: any) => {
				draft.a = 2
			})
			expect(next).toEqual({a: 2, b: next})
		}).not.toThrow()
	}
})

test("unmodified circular object", () => {
	const immer = new Immer({allowMultiRefs: true})
	const base = {a: 1, b: null} as any
	base.b = base

	for (const env of ["production", "development", "testing"]) {
		process.env.NODE_ENV = env
		expect(() => {
			const next = immer.produce({state: null}, (draft: any) => {
				draft.state = base
			})
			expect(next.state).toBe(base)
		}).not.toThrow()
	}
})

test("circular object using a draft and a non-draft", () => {
	const immer = new Immer({allowMultiRefs: true})
	const baseState: Record<string, any> = {
		someValue: 'abcd',
		state1: null,
		state2: {state: null},
		state3: {state_: {state: null}},
		state4: {state__: {state_: {state: null}}},
	}
	baseState.state1 = baseState
	baseState.state2.state = baseState
	baseState.state3.state_.state = baseState
	baseState.state4.state__.state_.state = baseState

	for (const env of ["production", "development", "testing"]) {
		process.env.NODE_ENV = env
		v8.setFlagsFromString("--stack-size=2000")
		expect(() => {
			const next = immer.produce(baseState, (draft: any) => {
				draft.state3.state_.state.someValue = 'efgh'
				draft.state2.state.someValue = 'ijkl'
			})

			expect(next.someValue).toBe('ijkl')
		}).not.toThrow('Maximum call stack size exceeded')
	}
});

test("replacing a deeply-nested value modified elsewhere does not modify the original object", () => {

	// When failing, produces the following output:
	//  originalBase: {
    //    someState: { something: { b: 'b' } },
    //    someOtherState: { someState: { something: { b: 'b' } } }
    //  },
    //  base: {
    //    someState: { something: { b: 'b' } },
    //    someOtherState: { someState: { something: { b: 'a modified value' } } } // <----- ⚠ This should be 'b'; we just modified the original state! ⚠
    //  },
    //  next: {
    //    someState: { something: { b: 'a modified value' } },
    //    someOtherState: { someState: { something: { b: 'a modified value' } } }
    //  }


	const immer = new Immer({allowMultiRefs: true})

	const someState = {something: {b: 'b'}}
	const base = {someState, someOtherState: { someState }}

	const originalBaseString = JSON.stringify(base)

	const next = immer.produce(base, draft => {
		draft.someState.something.b = 'a modified value'
	})

	let hasError = true

	try {
		expect(next.someOtherState.someState).toBe(next.someState) // Make sure multi-ref is working on the surface first

		expect(next.someState.something.b).toBe('a modified value')
		expect(base.someState.something.b).not.toBe('a modified value')
		expect(next.someOtherState).not.toBe(base.someOtherState)

		expect(next.someOtherState.someState.something.b).toBe('a modified value')
		expect(base.someOtherState.someState.something.b).not.toBe('a modified value')
		expect(next.someOtherState).not.toBe(base.someOtherState)
		hasError = false
	} finally {
		if (hasError) console.log('Objects for test "replacing a deeply-nested value modified elsewhere does not modify the original object":',
			inspect({originalBase: JSON.parse(originalBaseString), base, next}, {depth: 99, colors: true})
		)
	}
});

describe("access value & change child's child value", () => {
	describe("with object", () => {
		const immer = new Immer({allowMultiRefs: true})
		const sameRef = {someNumber: 1, someString: "one"}
		const objectOfRefs = {a: sameRef, b: sameRef, c: sameRef, d: sameRef}

		const base = {
			objectRef1: objectOfRefs,
			objectRef2: objectOfRefs,
			objectRef3: objectOfRefs,
			objectRef4: objectOfRefs
		}
		const next = immer.produce(base, draft => {
			draft.objectRef2.b.someNumber = 2
			draft.objectRef3.c.someString = "two"
		})

		it("should have kept the Object refs the same", () => {
			expect(next.objectRef1).toBe(next.objectRef2),
				expect(next.objectRef2).toBe(next.objectRef3),
				expect(next.objectRef3).toBe(next.objectRef4)
		})

		it("should have updated the values across everything", () => {
			function verifyObjectReference(
				ref: {[key: string]: {someNumber: number; someString: string}},
				objectNum: number
			) {
				verifySingleReference(ref.a, objectNum, "a")
				verifySingleReference(ref.b, objectNum, "b")
				verifySingleReference(ref.c, objectNum, "c")
				verifySingleReference(ref.d, objectNum, "d")
			}

			function verifySingleReference(
				ref: {someNumber: number; someString: string},
				objectNum: number,
				refKey: string
			) {
				//it(`should have updated the values across everything (ref ${refKey.toUpperCase()} in object #${objectNum})`, () => {
					expect(ref.someNumber).toBe(2)
					expect(ref.someString).toBe("two")
				//})
			}

			verifyObjectReference(next.objectRef1, 1)
			verifyObjectReference(next.objectRef2, 2)
			verifyObjectReference(next.objectRef3, 3)
			verifyObjectReference(next.objectRef4, 4)
		});
	})

	describe("with map", () => {
		const immer = new Immer({allowMultiRefs: true})
		enableMapSet()
		const sameRef = {someNumber: 1, someString: "one"}
		const mapOfRefs = new Map([
			["a", sameRef],
			["b", sameRef],
			["c", sameRef],
			["d", sameRef]
		])

		const base = {
			mapRef1: mapOfRefs,
			mapRef2: mapOfRefs,
			mapRef3: mapOfRefs,
			mapRef4: mapOfRefs
		}
		const next = immer.produce(base, draft => {
			draft.mapRef2.get("b")!.someNumber = 2
			draft.mapRef3.get("c")!.someString = "two"
		})

		it("should have kept the Map refs the same", () => {
			expect(next.mapRef1).toBe(next.mapRef2),
				expect(next.mapRef2).toBe(next.mapRef3),
				expect(next.mapRef3).toBe(next.mapRef4)
		})

		it("should have updated the values across everything", () => {
			function verifyMapReference(
				ref: Map<string, {someNumber: number; someString: string}>,
				mapNum: number
			) {
				verifySingleReference(ref.get("a")!, mapNum, "a")
				verifySingleReference(ref.get("b")!, mapNum, "b")
				verifySingleReference(ref.get("c")!, mapNum, "c")
				verifySingleReference(ref.get("d")!, mapNum, "d")

				//it(`should have the same child refs (map #${mapNum})`, () => {
					expect(ref.get("a")).toBe(ref.get("b")),
						expect(ref.get("b")).toBe(ref.get("c")),
						expect(ref.get("c")).toBe(ref.get("d"))
				//})
			}

			function verifySingleReference(
				ref: {someNumber: number; someString: string},
				mapNum: number,
				refKey: string
			) {
				//it(`should have updated the values across everything (ref ${refKey.toUpperCase()} in map #${mapNum})`, () => {
					expect(ref.someNumber).toBe(2)
					expect(ref.someString).toBe("two")
				//})
			}

			verifyMapReference(next.mapRef1, 1)
			verifyMapReference(next.mapRef2, 2)
			verifyMapReference(next.mapRef3, 3)
			verifyMapReference(next.mapRef4, 4)

		});
	})

	describe("with array", () => {
		const immer = new Immer({allowMultiRefs: true})
		const sameRef = {someNumber: 1, someString: "one"}
		const arrayOfRefs = [sameRef, sameRef, sameRef, sameRef]

		const base = {
			arrayRef1: arrayOfRefs,
			arrayRef2: arrayOfRefs,
			arrayRef3: arrayOfRefs,
			arrayRef4: arrayOfRefs
		}
		const next = immer.produce(base, draft => {
			draft.arrayRef2[1].someNumber = 2
			draft.arrayRef3[2].someString = "two"
		})

		it("should have kept the Array refs the same", () => {
			expect(next.arrayRef1).toBe(next.arrayRef2),
				expect(next.arrayRef2).toBe(next.arrayRef3),
				expect(next.arrayRef3).toBe(next.arrayRef4)
		})

		it("should have updated the values across everything", () => {
			function verifyArrayReference(
				ref: {someNumber: number; someString: string}[],
				arrayNum: number
			) {
				let i = 0
				for (const value of ref) {
					//it(`should have updated the values across everything (ref #${i++} in array #${arrayNum})`, () => {
						verifySingleReference(value)
					//})
				}
			}

			function verifySingleReference(ref: {
				someNumber: number
				someString: string
			}) {
				expect(ref.someNumber).toBe(2)
				expect(ref.someString).toBe("two")
			}

			verifyArrayReference(next.arrayRef1, 1)
			verifyArrayReference(next.arrayRef2, 2)
			verifyArrayReference(next.arrayRef3, 3)
			verifyArrayReference(next.arrayRef4, 4)
		});
	})

	describe("with set", () => {
		const immer = new Immer({allowMultiRefs: true})
		enableMapSet()
		const sameRef = {someNumber: 1, someString: "one"}
		const setOfRefs = new Set([{sameRef}, {sameRef}, {sameRef}, {sameRef}])

		const base = {
			setRef1: setOfRefs,
			setRef2: setOfRefs,
			setRef3: setOfRefs,
			setRef4: setOfRefs
		}
		//console.log("base", inspect(base, {depth: 6, colors: true, compact: true}))

		const next = immer.produce(base, draft => {
			const set2Values = draft.setRef2.values()
			set2Values.next()
			set2Values.next().value.sameRef.someNumber = 2

			const set3Values = draft.setRef3.values()
			set3Values.next()
			set3Values.next()
			set3Values.next().value.sameRef.someString = "two"
		})

		//console.log(
		//	"next",
		//	inspect(next, {
		//		depth: 20,
		//		colors: true,
		//		compact: true,
		//		breakLength: Infinity
		//	})
		//)

		it("should have kept the Set refs the same", () => {
			expect(next.setRef1).toBe(next.setRef2),
				expect(next.setRef2).toBe(next.setRef3),
				expect(next.setRef3).toBe(next.setRef4)
		})

		it("should have updated the values across everything", () => {
			function verifySetReference(
				ref: Set<{sameRef: {someNumber: number; someString: string}}>,
				setLetter: string
			) {
				//it(`should have the same child refs (set ${setLetter.toUpperCase()})`, () => {
					let first = ref.values().next().value.sameRef
					for (const value of Array.from(ref)) {
						expect(value.sameRef).toBe(first)
					}
				//})

				let i = 0
				for (const value of Array.from(ref)) {
					//it(`should have updated the values across everything (ref #${i++} in set ${setLetter.toUpperCase()})`, () => {
						verifySingleReference(value.sameRef)
					//})
				}
			}

			function verifySingleReference(ref: {
				someNumber: number
				someString: string
			}) {
				expect(ref.someNumber).toBe(2)
				expect(ref.someString).toBe("two")
			}

			verifySetReference(next.setRef1, "a")
			verifySetReference(next.setRef2, "b")
			verifySetReference(next.setRef3, "c")
			verifySetReference(next.setRef4, "d")

		});
	})
})
