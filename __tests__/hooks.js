"use strict"
import {Immer, setUseProxies} from "../src/index"
import matchers from "expect/build/matchers"

describe("hooks (proxy) -", () => createHookTests(true))
describe("hooks (es5) -", () => createHookTests(false))

function createHookTests(useProxies) {
    let produce, onAssign, onDelete, onCopy

    beforeEach(() => {
        ;({produce, onAssign, onDelete, onCopy} = new Immer({
            autoFreeze: true,
            useProxies,
            onAssign: defuseProxies(jest.fn().mockName("onAssign")),
            onDelete: defuseProxies(jest.fn().mockName("onDelete")),
            onCopy: defuseProxies(jest.fn().mockName("onCopy"))
        }))
    })

    describe("onAssign()", () => {
        useSharedTests(() => onAssign)
        describe("when draft is an object", () => {
            test("assign", () => {
                produce({a: 0, b: 0, c: 0}, s => {
                    s.a++
                    s.c++
                })
                expectCalls(onAssign)
            })
            test("assign (no change)", () => {
                produce({a: 0}, s => {
                    s.a = 0
                })
                expect(onAssign).not.toBeCalled()
            })
            test("delete", () => {
                produce({a: 1}, s => {
                    delete s.a
                })
                expect(onAssign).not.toBeCalled()
            })
            test("nested assignments", () => {
                produce({a: {b: {c: 1, d: 1, e: 1}}}, s => {
                    const {b} = s.a
                    b.c = 2
                    delete b.d
                    b.e = 1 // no-op
                })
                expectCalls(onAssign)
            })
        })
        describe("when draft is an array", () => {
            test("assign", () => {
                produce([1], s => {
                    s[0] = 0
                })
                expectCalls(onAssign)
            })
            test("push", () => {
                produce([], s => {
                    s.push(4)
                })
                expectCalls(onAssign)
            })
            test("pop", () => {
                produce([1], s => {
                    s.pop()
                })
                expect(onAssign).not.toBeCalled()
            })
            test("unshift", () => {
                produce([1], s => {
                    s.unshift(0)
                })
                expectCalls(onAssign)
            })
            test("length = 0", () => {
                produce([1], s => {
                    s.length = 0
                })
                expect(onAssign).not.toBeCalled()
            })
            test("splice (length += 1)", () => {
                produce([1, 2, 3], s => {
                    s.splice(1, 1, 0, 0)
                })
                expectCalls(onAssign)
            })
            test("splice (length += 0)", () => {
                produce([1, 2, 3], s => {
                    s.splice(1, 1, 0)
                })
                expectCalls(onAssign)
            })
            test("splice (length -= 1)", () => {
                produce([1, 2, 3], s => {
                    s.splice(0, 2, 6)
                })
                expectCalls(onAssign)
            })
        })
        describe("when a draft is moved into a new object", () => {
            it("is called in the right order", () => {
                const calls = []
                onAssign.mockImplementation((_, prop) => {
                    calls.push(prop)
                })
                produce({a: {b: 1, c: {}}}, s => {
                    s.a.b = 0
                    s.a.c.d = 1
                    s.x = {y: {z: s.a}}
                    delete s.a
                })
                // Sibling properties use enumeration order, which means new
                // properties come last among their siblings. The deepest
                // properties always come first in their ancestor chain.
                expect(calls).toEqual(["b", "d", "c", "x"])
            })
        })

        if (useProxies) {
            describe("when draft is a Map", () => {
                test("assign", () => {
                    const key1 = {prop: "val1"}
                    const key2 = {prop: "val2"}
                    produce(new Map([["a", 0], [key1, 1], [key2, 2]]), s => {
                        s.set("a", 10)
                        s.set(key1, 11)
                    })
                    expectCalls(onAssign)
                })
                test("assign (no change)", () => {
                    produce(new Map([["a", 0]]), s => {
                        s.set("a", 0)
                    })
                    expect(onAssign).not.toBeCalled()
                })
                test("delete", () => {
                    produce(new Map([["a", 0]]), s => {
                        s.delete("a")
                    })
                    expect(onAssign).not.toBeCalled()
                })
                test("nested assignments", () => {
                    const key1 = {prop: "val1"}
                    produce(
                        new Map([
                            [
                                "a",
                                new Map([
                                    [
                                        key1,
                                        new Map([["b", 1], ["c", 1], ["d", 1]])
                                    ]
                                ])
                            ]
                        ]),
                        s => {
                            const nested = s.get("a").get(key1)
                            nested.set("b", 2)
                            nested.delete("c")
                            nested.set("d", 1) // no-op
                        }
                    )
                    expectCalls(onAssign)
                })
            })
        }
    })

    describe("onDelete()", () => {
        useSharedTests(() => onDelete)
        describe("when draft is an object -", () => {
            test("delete", () => {
                produce({a: 1, b: 1, c: 1}, s => {
                    delete s.a
                    delete s.c
                })
                expectCalls(onDelete)
            })
            test("delete (no change)", () => {
                produce({}, s => {
                    delete s.a
                })
                expect(onDelete).not.toBeCalled()
            })
            test("nested deletions", () => {
                produce({a: {b: {c: 1}}}, s => {
                    delete s.a.b.c
                })
                expectCalls(onDelete)
            })
        })
        describe("when draft is an array -", () => {
            test("pop", () => {
                produce([1], s => {
                    s.pop()
                })
                expectCalls(onDelete)
            })
            test("length = 0", () => {
                produce([1], s => {
                    s.length = 0
                })
                expectCalls(onDelete)
            })
            test("splice (length -= 1)", () => {
                produce([1, 2, 3], s => {
                    s.splice(0, 2, 6)
                })
                expectCalls(onDelete)
            })
        })

        if (useProxies) {
            describe("when draft is a Map -", () => {
                test("delete", () => {
                    const key1 = {prop: "val1"}
                    const key2 = {prop: "val2"}
                    produce(new Map([["a", 0], [key1, 1], [key2, 2]]), s => {
                        s.delete("a")
                        s.delete(key1)
                    })
                    expectCalls(onDelete)
                })
                test("delete (no change)", () => {
                    produce(new Map(), s => {
                        s.delete("a")
                    })
                    expect(onDelete).not.toBeCalled()
                })
                test("nested deletions", () => {
                    const key1 = {prop: "val1"}
                    produce(
                        new Map([
                            ["a", new Map([[key1, new Map([["b", 1]])]])]
                        ]),
                        s => {
                            s.get("a")
                                .get(key1)
                                .delete("b")
                        }
                    )
                    expectCalls(onDelete)
                })
            })
        }
    })

    describe("onCopy()", () => {
        let calls
        beforeEach(() => {
            calls = []
            onCopy.mockImplementation(s => {
                calls.push(s.base)
            })
        })

        useSharedTests(() => onCopy)
        it("is called in the right order for objects", () => {
            const base = {a: {b: {c: 1}}}
            produce(base, s => {
                delete s.a.b.c
            })
            expect(calls).toShallowEqual([base.a.b, base.a, base])
        })

        if (useProxies) {
            it("is called in the right order for Maps", () => {
                const base = new Map([["a", new Map([["b", 0]])]])
                produce(base, s => {
                    s.get("a").delete("b")
                })
                expect(calls).toShallowEqual([base.get("a"), base])
            })
        }
    })

    function useSharedTests(getHook) {
        it("is called before the parent is frozen", () => {
            const hook = getHook()
            hook.mockImplementation(s => {
                // Parent object must not be frozen.
                expect(Object.isFrozen(s.base)).toBeFalsy()
            })
            produce({a: {b: {c: 0}}}, s => {
                if (hook == onDelete) delete s.a.b.c
                else s.a.b.c = 1
            })
            expect(hook).toHaveBeenCalledTimes(hook == onDelete ? 1 : 3)
        })
    }
}

// Produce a snapshot of the hook arguments (minus any draft state).
function expectCalls(hook) {
    expect(
        hook.mock.calls.map(call => {
            return call.slice(1)
        })
    ).toMatchSnapshot()
}

// For defusing draft proxies.
function defuseProxies(fn) {
    return Object.assign((...args) => {
        expect(args[0].finalized).toBeTruthy()
        args[0].draft = args[0].drafts = null
        fn(...args)
    }, fn)
}

expect.extend({
    toShallowEqual(received, expected) {
        const match = matchers.toBe(received, expected)
        return match.pass || !received || typeof received !== "object"
            ? match
            : !Array.isArray(expected) ||
              (Array.isArray(received) && received.length === expected.length)
            ? matchers.toEqual(received, expected)
            : match
    }
})
