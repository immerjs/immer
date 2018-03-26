import produce, {setAutoFreeze, setUseProxies} from "../../src/immer"

setAutoFreeze(true)
setUseProxies(true)

// we really don't want this code to actually execute..
const result = produce({x: 3}, draft => {
    draft.x = 4

    // $ExpectError
    console.log(draft.y)
})

console.log(result.x)

const f2 = produce(draft => {})
f2({x: 3})

// $ExpectError
setAutoFreeze(3)

// $ExpectError
console.log(result.y)

// $ExpectError
produce()

// $ExpectError
produce({x: 3})

// $ExpectError
produce({x: 3}, [])

{
    // curried & initial arg
    const f = produce(
        (state, increment: number) => {
            state.x += increment
        },
        {x: 3}
    )

    // $ExpectError Too few arguments
    f({x: 5})

    // $ExpectError
    f({x: 5}, "test")

    f({x: 5}, 3)

    f(undefined, 3)
}

{
    // curried f & no initial arg
    const f2 = produce((state: {x: number}, increment: number) => {
        state.x += increment
    })

    f2({x: 5}, 3)

    // $ExpectError
    f2(undefined, 3)
}

{
    // Issue #129
    const handlers = {
        ["TEST"]: (draft: {}, {id, value}: {id: string; value: string}) => {
            draft[id] = {...draft[id], value}
            return draft
        }
    }

    const reducer = (state = {}, {type, payload}: any): any =>
        handlers[type]
            ? produce<any, any>(handlers[type])(state, payload)
            : state
}
