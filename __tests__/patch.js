"use strict"
import produce, {setUseProxies, applyPatches} from "../src/index"

jest.setTimeout(1000)

function runPatchTest(
    base,
    producer,
    patches,
    inversePathes,
    proxyOnly = false
) {
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
        beforeAll(() => setUseProxies(true))
        runPatchTestHelper()
    })

    describe(`es5`, () => {
        if (!proxyOnly) {
            beforeAll(() => setUseProxies(false))
            runPatchTestHelper()
        }
    })
}

describe("applyPatches", () => {
    it("mutates the base state when it is a draft", () => {
        produce({a: 1}, draft => {
            const result = applyPatches(draft, [
                {op: "replace", path: ["a"], value: 2}
            ])
            expect(result).toBe(draft)
            expect(draft.a).toBe(2)
        })
    })
    it("produces a copy of the base state when not a draft", () => {
        const base = {a: 1}
        const result = applyPatches(base, [
            {op: "replace", path: ["a"], value: 2}
        ])
        expect(result).not.toBe(base)
        expect(result.a).toBe(2)
        expect(base.a).toBe(1)
    })
    it('throws when `op` is not "add", "replace", nor "remove"', () => {
        expect(() => {
            const patch = {op: "copy", from: [0], path: [1]}
            applyPatches([2], [patch])
        }).toThrowErrorMatchingSnapshot()
    })
    it("throws when `path` cannot be resolved", () => {
        // missing parent
        expect(() => {
            const patch = {op: "add", path: ["a", "b"], value: 1}
            applyPatches({}, [patch])
        }).toThrowErrorMatchingSnapshot()

        // missing grand-parent
        expect(() => {
            const patch = {op: "add", path: ["a", "b", "c"], value: 1}
            applyPatches({}, [patch])
        }).toThrowErrorMatchingSnapshot()
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

describe("simple assignment - 3", () => {
    runPatchTest(
        {x: [{y: 4}]},
        d => {
            d.x[0].y++
        },
        [{op: "replace", path: ["x", 0, "y"], value: 5}]
    )
})

describe("simple assignment - 4", () => {
    runPatchTest(
        new Map([["x", {y: 4}]]),
        d => {
            d.get("x").y++
        },
        [{op: "replace", path: ["x", "y"], value: 5}],
        [{op: "replace", path: ["x", "y"], value: 4}],
        true
    )
})

describe("simple assignment - 5", () => {
    runPatchTest(
        {x: new Map([["y", 4]])},
        d => {
            d.x.set("y", 5)
        },
        [{op: "replace", path: ["x", "y"], value: 5}],
        [{op: "replace", path: ["x", "y"], value: 4}],
        true
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

describe("delete 2", () => {
    runPatchTest(
        new Map([["x", 1]]),
        d => {
            d.delete("x")
        },
        [{op: "remove", path: ["x"]}],
        [{op: "add", path: ["x"], value: 1}],
        true
    )
})

describe("delete 3", () => {
    runPatchTest(
        {x: new Map([["y", 1]])},
        d => {
            d.x.delete("y")
        },
        [{op: "remove", path: ["x", "y"]}],
        [{op: "add", path: ["x", "y"], value: 1}],
        true
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

    describe("nested map (no changes)", () => {
        runPatchTest(
            new Map([["a", new Map([["b", 1]])]]),
            d => {
                d.set("x", d.get("a"))
                d.delete("a")
            },
            [
                {op: "add", path: ["x"], value: new Map([["b", 1]])},
                {op: "remove", path: ["a"]}
            ],
            [
                {op: "remove", path: ["x"]},
                {op: "add", path: ["a"], value: new Map([["b", 1]])}
            ],
            true
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

    describe("nested map (with changes)", () => {
        runPatchTest(
            new Map([["a", new Map([["b", 1], ["c", 1]])]]),
            d => {
                let a = d.get("a")
                a.set("b", 2) // change
                a.delete("c") // delete
                a.set("y", 2) // add

                // rename
                d.set("x", a)
                d.delete("a")
            },
            [
                {op: "add", path: ["x"], value: new Map([["b", 2], ["y", 2]])},
                {op: "remove", path: ["a"]}
            ],
            [
                {op: "remove", path: ["x"]},
                {op: "add", path: ["a"], value: new Map([["b", 1], ["c", 1]])}
            ],
            true
        )
    })

    describe("deeply nested object (with changes)", () => {
        runPatchTest(
            {a: {b: {c: 1, d: 1}}},
            d => {
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

    describe("deeply nested map (with changes)", () => {
        runPatchTest(
            new Map([["a", new Map([["b", new Map([["c", 1], ["d", 1]])]])]]),
            d => {
                let b = d.get("a").get("b")
                b.set("c", 2) // change
                b.delete("d") // delete
                b.set("y", 2) // add

                // rename
                d.get("a").set("x", b)
                d.get("a").delete("b")
            },
            [
                {
                    op: "add",
                    path: ["a", "x"],
                    value: new Map([["c", 2], ["y", 2]])
                },
                {op: "remove", path: ["a", "b"]}
            ],
            [
                {op: "remove", path: ["a", "x"]},
                {
                    op: "add",
                    path: ["a", "b"],
                    value: new Map([["c", 1], ["d", 1]])
                }
            ],
            true
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
        [{op: "add", path: ["x", 0], value: 4}]
    )
})

describe("arrays - multiple prepend", () => {
    runPatchTest(
        {x: [1, 2, 3]},
        d => {
            d.x.unshift(4)
            d.x.unshift(5)
        },
        [
            {op: "add", path: ["x", 0], value: 5},
            {op: "add", path: ["x", 1], value: 4}
        ]
    )
})

describe("arrays - splice middle", () => {
    runPatchTest(
        {x: [1, 2, 3]},
        d => {
            d.x.splice(1, 1)
        },
        [{op: "remove", path: ["x", 1]}]
    )
})

describe("arrays - multiple splice", () => {
    runPatchTest(
        [0, 1, 2, 3, 4, 5, 0],
        d => {
            d.splice(4, 2, 3)
            d.splice(1, 2, 3)
        },
        [
            {op: "replace", path: [1], value: 3},
            {op: "replace", path: [2], value: 3},
            {op: "remove", path: [5]},
            {op: "remove", path: [4]}
        ]
    )
})

describe("arrays - modify and shrink", () => {
    runPatchTest(
        {x: [1, 2, 3]},
        d => {
            d.x[0] = 4
            d.x.length = 2
        },
        [
            {op: "replace", path: ["x", 0], value: 4},
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

describe("arrays - splice (expand)", () => {
    runPatchTest(
        {x: [1, 2, 3]},
        d => {
            d.x.splice(1, 1, 4, 5, 6)
        },
        [
            {op: "replace", path: ["x", 1], value: 4},
            {op: "add", path: ["x", 2], value: 5},
            {op: "add", path: ["x", 3], value: 6}
        ],
        [
            {op: "replace", path: ["x", 1], value: 2},
            {op: "remove", path: ["x", 3]},
            {op: "remove", path: ["x", 2]}
        ]
    )
})

describe("arrays - splice (shrink)", () => {
    runPatchTest(
        {x: [1, 2, 3, 4, 5]},
        d => {
            d.x.splice(1, 3, 6)
        },
        [
            {op: "replace", path: ["x", 1], value: 6},
            {op: "remove", path: ["x", 3]},
            {op: "remove", path: ["x", 2]}
        ],
        [
            {op: "replace", path: ["x", 1], value: 2},
            {op: "add", path: ["x", 2], value: 3},
            {op: "add", path: ["x", 3], value: 4}
        ]
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
        []
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
        []
    )
})

describe("same value replacement - 5", () => {
    runPatchTest(
        new Map([["x", 3]]),
        d => {
            d.set("x", 4)
            d.set("x", 3)
        },
        [],
        [],
        true
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
