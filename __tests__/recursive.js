"use strict"
import produce, {setUseProxies} from "../src/immer"
import {isArray, isPlainObject, isString, keys, trim} from "lodash"

const nonPlainObject = () => {}

runTests("proxy", true)
runTests("es5", false)

function runTests(name, useProxies) {
    describe("recursive - " + name, () => {
        setUseProxies(useProxies)

        const testCases = [
            {
                title: "in a simple non-recursive case",
                recursiveTransform: recursivelyTrimStrings,
                baseState: "  hello ",
                desiredState: "hello"
            },
            {
                title: "in a simple non-recursive unchanged case",
                recursiveTransform: recursivelyTrimStrings,
                baseState: "hello",
                desiredState: "hello"
            },
            {
                title: "if baseState is an object that does not change",
                recursiveTransform: recursivelyTrimStrings,
                baseState: {
                    a: 1,
                    b: "test",
                    c: {
                        a: [true, null, false, "test"],
                        b: 1
                    }
                }
            },
            {
                title: "if baseState is an array does not change",
                recursiveTransform: recursivelyTrimStrings,
                baseState: [true, null, false, "test"]
            },
            {
                title: "when all leafs are changing",
                recursiveTransform: recursivelyTrimStrings,
                baseState: {
                    x: "  hello ",
                    arr: [
                        "world    ",
                        42,
                        " !!!",
                        {
                            x: 42,
                            test: "true  "
                        }
                    ]
                },
                desiredState: {
                    x: "hello",
                    arr: [
                        "world",
                        42,
                        "!!!",
                        {
                            x: 42,
                            test: "true"
                        }
                    ]
                }
            },
            {
                title: "when there is an unchanged leaf array",
                recursiveTransform: recursivelyTrimStrings,
                baseState: {
                    x: "  hello ",
                    arr: [1, 2, 3]
                },
                desiredState: {
                    x: "hello",
                    arr: [1, 2, 3]
                }
            },
            {
                title:
                    "when there is an unchanged leaf object in an unchanged array",
                recursiveTransform: recursivelyTrimStrings,
                baseState: {
                    arr: [
                        "!!!",
                        {
                            x: 42,
                            y: "test"
                        }
                    ]
                },
                desiredState: {
                    arr: [
                        "!!!",
                        {
                            x: 42,
                            y: "test"
                        }
                    ]
                }
            },
            {
                title:
                    "when there is an unchanged leaf object in a changed array",
                recursiveTransform: recursivelyTrimStrings,
                baseState: {
                    arr: [
                        " !!!",
                        {
                            x: 42,
                            y: "test"
                        }
                    ]
                },
                desiredState: {
                    arr: [
                        "!!!",
                        {
                            x: 42,
                            y: "test"
                        }
                    ]
                }
            },
            {
                title:
                    "when there is an unchanged leaf array in a changed object",
                recursiveTransform: recursivelyTrimStrings,
                baseState: {
                    test: "!!! ",
                    arr: [1, 2, 3]
                },
                desiredState: {
                    test: "!!!",
                    arr: [1, 2, 3]
                }
            },
            {
                title: "when there non-plain objects",
                recursiveTransform: recursivelyTrimStrings,
                baseState: {
                    a: [nonPlainObject, 1],
                    b: nonPlainObject
                }
            }
        ]

        testCases
            .slice(0, 9)
            .forEach(({title, baseState, desiredState, recursiveTransform}) => {
                it(`should not leave drafts ${title}`, () => {
                    const next = recursiveTransform(baseState)
                    if (desiredState) {
                        // an exception is thrown during deep comparison if any of the drafts is not finalized
                        expect(next).toEqual(desiredState)
                    } else {
                        expect(next).toBe(baseState)
                    }
                })
            })
    })
}

function recursivelyTrimStrings(source) {
    if (isString(source)) {
        return trim(source)
    } else if (isArray(source)) {
        return produce(source, draft =>
            draft.forEach((el, i) => {
                const v = recursivelyTrimStrings(el)
                draft[i] = v
            })
        )
    } else if (isPlainObject(source)) {
        return produce(source, draft => {
            keys(draft).forEach(key => {
                draft[key] = recursivelyTrimStrings(draft[key])
            })
        })
    }
    return source
}
