"use strict"
import produce, {setUseProxies, applyPatches} from "../src/index"

jest.setTimeout(1000)

function runPatchTest(base, producer, patches, inversePathes) {
    function runPatchTestHelper() {
        let recordedPatches
        let recordedInversePatches
        const res = produce(base, producer, (p, i) => {
            recordedPatches = p
            recordedInversePatches = i
        })

        test("produces the correct patches", () => {
            expect(recordedPatches).toEqual(patches)
            if (inversePathes)
                expect(recordedInversePatches).toEqual(inversePathes)
        })

        test("patches are replayable", () => {
            expect(applyPatches(base, recordedPatches)).toEqual(res)
        })

        test("patches can be reversed", () => {
            expect(applyPatches(res, recordedInversePatches)).toEqual(base)
        })
    }

    describe(`proxy`, () => {
        setUseProxies(true)
        runPatchTestHelper()
    })

    describe(`es5`, () => {
        setUseProxies(false)
        runPatchTestHelper()
    })
}

describe("applyPatches", () => {
    it('throws when `op` is not "add", "replace", nor "remove"', () => {
        expect(() => {
            const patch = {op: "copy", from: [0], path: [1]}
            applyPatches([2], [patch])
        }).toThrowError(/^Unsupported patch operation:/)
    })
    it("throws when `path` cannot be resolved", () => {
        // missing parent
        expect(() => {
            const patch = {op: "add", path: ["a", "b"], value: 1}
            applyPatches({}, [patch])
        }).toThrowError(/^Cannot apply patch, path doesn't resolve:/)

        // missing grand-parent
        expect(() => {
            const patch = {op: "add", path: ["a", "b", "c"], value: 1}
            applyPatches({}, [patch])
        }).toThrowError(/^Cannot apply patch, path doesn't resolve:/)
    })
    it("throws when a patch tries to splice an array", () => {
        // Pop is ok
        expect(() => {
            const patch = {op: "remove", path: [0]}
            applyPatches([1], [patch])
        }).not.toThrowError()

        // Splice is unsupported
        expect(() => {
            const patch = {op: "remove", path: [0]}
            applyPatches([1, 2], [patch])
        }).toThrowError(/^Only the last index of an array can be removed/)
    })
})

describe("simple assignment - 1", () => {
    runPatchTest(
        {x: 3},
        d => {
            d.x++
        },
        [{op: "replace", path: ["x"], value: 4}]
    )
})

describe("simple assignment - 2", () => {
    runPatchTest(
        {x: {y: 4}},
        d => {
            d.x.y++
        },
        [{op: "replace", path: ["x", "y"], value: 5}]
    )
})

describe("delete 1", () => {
    runPatchTest(
        {x: {y: 4}},
        d => {
            delete d.x
        },
        [{op: "remove", path: ["x"]}]
    )
})

describe("renaming properties", () => {
    describe("nested object (no changes)", () => {
        runPatchTest(
            {a: {b: 1}},
            d => {
                d.x = d.a
                delete d.a
            },
            [
                {op: "add", path: ["x"], value: {b: 1}},
                {op: "remove", path: ["a"]}
            ]
        )
    })

    describe("nested object (with changes)", () => {
        runPatchTest(
            {a: {b: 1, c: 1}},
            d => {
                let a = d.a
                a.b = 2 // change
                delete a.c // delete
                a.y = 2 // add

                // rename
                d.x = a
                delete d.a
            },
            [
                {op: "add", path: ["x"], value: {b: 2, y: 2}},
                {op: "remove", path: ["a"]}
            ]
        )
    })

    describe("deeply nested object (with changes)", () => {
        runPatchTest(
            {a: {b: {c: 1, d: 1}}},
            d => {
                debugger
                let b = d.a.b
                b.c = 2 // change
                delete b.d // delete
                b.y = 2 // add

                // rename
                d.a.x = b
                delete d.a.b
            },
            [
                {op: "add", path: ["a", "x"], value: {c: 2, y: 2}},
                {op: "remove", path: ["a", "b"]}
            ]
        )
    })
})

describe("minimum amount of changes", () => {
    runPatchTest(
        {x: 3, y: {a: 4}, z: 3},
        d => {
            d.y.a = 4
            d.y.b = 5
            Object.assign(d, {x: 4, y: {a: 2}})
        },
        [
            {op: "replace", path: ["x"], value: 4},
            {op: "replace", path: ["y"], value: {a: 2}}
        ]
    )
})

describe("arrays - prepend", () => {
    runPatchTest(
        {x: [1, 2, 3]},
        d => {
            d.x.unshift(4)
        },
        [
            {op: "replace", path: ["x", 0], value: 4},
            {op: "replace", path: ["x", 1], value: 1},
            {op: "replace", path: ["x", 2], value: 2},
            {op: "add", path: ["x", 3], value: 3}
        ]
    )
})

describe("arrays - splice middle", () => {
    runPatchTest(
        {x: [1, 2, 3]},
        d => {
            d.x.splice(1, 1)
        },
        [
            {op: "replace", path: ["x", 1], value: 3},
            {op: "replace", path: ["x", "length"], value: 2}
        ]
    )
})

describe("arrays - prepend then splice middle", () => {
    runPatchTest(
        {x: [1, 2, 3]},
        d => {
            d.x.unshift(4)
            d.x.splice(2, 1)
        },
        [
            {op: "replace", path: ["x", 0], value: 4},
            {op: "replace", path: ["x", 1], value: 1}
        ]
    )
})

describe("arrays - splice middle then prepend", () => {
    runPatchTest(
        {x: [1, 2, 3]},
        d => {
            d.x.splice(1, 1)
            d.x.unshift(4)
        },
        [
            {op: "replace", path: ["x", 0], value: 4},
            {op: "replace", path: ["x", 1], value: 1}
        ]
    )
})

describe("arrays - truncate", () => {
    runPatchTest(
        {x: [1, 2, 3]},
        d => {
            d.x.length -= 2
        },
        [{op: "replace", path: ["x", "length"], value: 1}],
        [
            {op: "add", path: ["x", 1], value: 2},
            {op: "add", path: ["x", 2], value: 3}
        ]
    )
})

describe("arrays - pop twice", () => {
    runPatchTest(
        {x: [1, 2, 3]},
        d => {
            d.x.pop()
            d.x.pop()
        },
        [{op: "replace", path: ["x", "length"], value: 1}]
    )
})

describe("arrays - push multiple", () => {
    runPatchTest(
        {x: [1, 2, 3]},
        d => {
            d.x.push(4, 5)
        },
        [
            {op: "add", path: ["x", 3], value: 4},
            {op: "add", path: ["x", 4], value: 5}
        ],
        [{op: "replace", path: ["x", "length"], value: 3}]
    )
})

describe("simple replacement", () => {
    runPatchTest({x: 3}, _d => 4, [{op: "replace", path: [], value: 4}])
})

describe("same value replacement - 1", () => {
    runPatchTest(
        {x: {y: 3}},
        d => {
            const a = d.x
            d.x = a
        },
        []
    )
})

describe("same value replacement - 2", () => {
    runPatchTest(
        {x: {y: 3}},
        d => {
            const a = d.x
            d.x = 4
            d.x = a
        },
        // immer does not detect this is not an actual change
        [{op: "replace", path: ["x"], value: {y: 3}}]
    )
})

describe("same value replacement - 3", () => {
    runPatchTest(
        {x: 3},
        d => {
            d.x = 3
        },
        []
    )
})

describe("same value replacement - 4", () => {
    runPatchTest(
        {x: 3},
        d => {
            d.x = 4
            d.x = 3
        },
        // immer does not detect this is not an actual change
        [{op: "replace", path: ["x"], value: 3}]
    )
})

describe("simple delete", () => {
    runPatchTest(
        {x: 2},
        d => {
            delete d.x
        },
        [
            {
                op: "remove",
                path: ["x"]
            }
        ]
    )
})
