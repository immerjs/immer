"use strict"
import produce, {setUseProxies, applyPatches} from "../src/immer"

jest.setTimeout(1000)

function runPatchTest(name, base, producer, patches) {
    function runPatchTestHelper() {
        let recordedPatches
        let inversePatches
        const res = produce(base, producer, (p, i) => {
            recordedPatches = p
            inversePatches = i
        })

        test("produces the correct patches", () => {
            expect(recordedPatches).toEqual(patches)
        })

        test("patches are replayable", () => {
            expect(applyPatches(base, recordedPatches)).toEqual(res)
        })

        test("patches can be revered", () => {
            expect(applyPatches(res, inversePatches)).toEqual(base)
        })
    }

    describe(`patches - ${name} - proxy`, () => {
        setUseProxies(true)
        runPatchTestHelper()
    })

    describe(`patches - ${name} - es5`, () => {
        setUseProxies(false)
        runPatchTestHelper()
    })
}

runPatchTest(
    "simple assignment",
    {x: 3},
    d => {
        d.x++
    },
    [{op: "replace", path: ["x"], value: 4}]
)

runPatchTest(
    "simple assignment - 2",
    {x: {y: 4}},
    d => {
        d.x.y++
    },
    [{op: "replace", path: ["x", "y"], value: 5}]
)

runPatchTest(
    "simple assignment - 2",
    {x: {y: 4}},
    d => {
        d.x.y++
    },
    [{op: "replace", path: ["x", "y"], value: 5}]
)

runPatchTest(
    "delete 1",
    {x: {y: 4}},
    d => {
        delete d.x
    },
    [{op: "remove", path: ["x"]}]
)

runPatchTest(
    "moving stuff",
    {x: {y: 4}},
    d => {
        d.z = d.x
        d.z.y++
        delete d.x
    },
    [{op: "replace", path: ["z"], value: {y: 5}}, {op: "remove", path: ["x"]}]
)

runPatchTest(
    "minimum amount of changes",
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

runPatchTest(
    "arrays",
    {x: [1, 2, 3]},
    d => {
        d.x.unshift(4)
        d.x.splice(2, 1)
    },
    [
        {op: "replace", path: ["x", "0"], value: 4},
        {op: "replace", path: ["x", "1"], value: 1},
        {op: "replace", path: ["x", "2"], value: 3},
        {op: "remove", path: ["x", "3"]},
        {op: "replace", path: ["x", "length"], value: 3}
    ]
)

runPatchTest("simple replacement", {x: 3}, _d => 4, [
    {op: "replace", path: [], value: 4}
])
