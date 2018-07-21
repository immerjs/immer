"use strict"
import produce, {setUseProxies} from "../src/immer"

jest.setTimeout(1000)

function runPatchTest(name, base, producer, patches) {
    function runPatchTest() {
        let recordedPatches
        let inversePatches
        const res = produce(base, producer, (p, i) => {
            recordedPatches = p
            inversePatches = i
        })

        test("produces the correct patches", () => {
            expect(recordedPatches).toEqual(patches)
        })

        test.skip("patches are replayable", () => {
            expect(applyPatches(base, recordedPatches)).toBe(res)
        })

        test.skip("patches can be revered", () => {
            expect(applyPatches(res, inversePatches)).toBe(base)
        })
    }

    describe(`patches - ${name} - proxy`, () => {
        setUseProxies(true)
        runPatchTest()
    })

    describe.skip(`patches - ${name} - es5`, () => {
        setUseProxies(false)
        runPatchTest()
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

// runPatchTest("simple replacement", { x: 3 }, _d => 4, [{ op: "replace", path: [], value: 4 }])
