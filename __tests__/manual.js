"use strict"
import {setUseProxies, createDraft, finishDraft, produce} from "../src/index"

runTests("proxy", true)
runTests("es5", false)

function runTests(name, useProxies) {
    describe("manual - " + name, () => {
        setUseProxies(useProxies)

        it("should check arguments", () => {
            expect(() => createDraft(3)).toThrow(
                "argument to createDraft should be a plain"
            )
            expect(() => createDraft(new Buffer([]))).toThrow(
                "argument to createDraft should be a plain"
            )
            expect(() => finishDraft({})).toThrow(
                "First argument to finishDraft should be "
            )
        })

        it("should support manual drafts", () => {
            const state = [{}, {}, {}]

            const draft = createDraft(state)
            draft.forEach((item, index) => {
                item.index = index
            })

            const result = finishDraft(draft)

            expect(result).not.toBe(state)
            expect(result).toEqual([{index: 0}, {index: 1}, {index: 2}])
            expect(state).toEqual([{}, {}, {}])
        })

        it("cannot modify after finish", () => {
            const state = {a: 1}

            const draft = createDraft(state)
            draft.a = 2
            expect(finishDraft(draft)).toEqual({a: 2})
            expect(() => {
                draft.a = 3
            }).toThrow("Cannot use a proxy that has been revoked")
        })

        it("should support patches drafts", () => {
            const state = {a: 1}

            const draft = createDraft(state)
            draft.a = 2
            draft.b = 3

            const patches = []
            const result = finishDraft(draft, (p, ip) => {
                patches.push(p, ip)
            })

            expect(result).not.toBe(state)
            expect(result).toEqual({a: 2, b: 3})
            expect(patches).toEqual([
                [
                    {
                        op: "replace",
                        path: ["a"],
                        value: 2
                    },
                    {
                        op: "add",
                        path: ["b"],
                        value: 3
                    }
                ],
                [
                    {
                        op: "replace",
                        path: ["a"],
                        value: 1
                    },
                    {
                        op: "remove",
                        path: ["b"]
                    }
                ]
            ])
        })

        it("should handle multiple create draft calls", () => {
            const state = {a: 1}

            const draft = createDraft(state)
            draft.a = 2

            const draft2 = createDraft(state)
            draft2.b = 3

            const result = finishDraft(draft)

            expect(result).not.toBe(state)
            expect(result).toEqual({a: 2})

            draft2.a = 4
            const result2 = finishDraft(draft2)
            expect(result2).not.toBe(result)
            expect(result2).toEqual({a: 4, b: 3})
        })

        it("combines with produce - 1", () => {
            const state = {a: 1}

            const draft = createDraft(state)
            draft.a = 2
            const res1 = produce(draft, d => {
                d.b = 3
            })
            draft.b = 4
            const res2 = finishDraft(draft)
            expect(res1).toEqual({a: 2, b: 3})
            expect(res2).toEqual({a: 2, b: 4})
        })

        it("combines with produce - 2", () => {
            const state = {a: 1}

            const res1 = produce(state, draft => {
                draft.b = 3
                const draft2 = createDraft(draft)
                draft.c = 4
                draft2.d = 5
                const res2 = finishDraft(draft2)
                expect(res2).toEqual({
                    a: 1,
                    b: 3,
                    d: 5
                })
                draft.d = 2
            })
            expect(res1).toEqual({
                a: 1,
                b: 3,
                c: 4,
                d: 2
            })
        })
    })
}
