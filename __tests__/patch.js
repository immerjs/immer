"use strict"
import produce, {setUseProxies, applyPatches} from "../src/immer"

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

        test("patches can be revered", () => {
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

describe("simple assignment", () => {
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

describe("moving stuff", () => {
    runPatchTest(
        {x: {y: 4}},
        d => {
            d.z = d.x
            d.z.y++
            delete d.x
        },
        [{op: "add", path: ["z"], value: {y: 5}}, {op: "remove", path: ["x"]}]
    )
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

describe("arrays - 1", () => {
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

describe("arrays - 2", () => {
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

describe("arrays - 3", () => {
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

describe("arrays - 4", () => {
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

describe("arrays - 5a", () => {
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

describe("arrays - 5b", () => {
    runPatchTest(
        {x: [1, 2, 3]},
        d => {
            d.x.pop()
            d.x.pop()
        },
        [{op: "replace", path: ["x", "length"], value: 1}]
    )
})

describe("arrays - 6", () => {
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

describe("delete props from object which is in the array", () => {
    runPatchTest(
        [1, 2, {m: 1111}],
        d => {
            delete d[2].m
        },
        [
            {
                op: "remove",
                path: [2, "m"]
            }
        ]
    )
})
