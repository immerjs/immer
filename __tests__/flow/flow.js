// @flow
import produce, {setAutoFreeze, setUseProxies} from "../../src/immer"

describe("it should support flow", () => {
    test("type checking should work", () => {
        if (parseInt("2" + "321"[2]) !== 21) {
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
        }
    })
})
