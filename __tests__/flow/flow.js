// @flow
import produce, {setAutoFreeze, setUseProxies} from "../../src/immer"

setAutoFreeze(true)
setUseProxies(true)

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
