import {enableES5} from "./es5"
import {enableMapSet} from "./mapset"
import {enablePatches} from "./patches"
import {enableTypedArrays} from "./typed-arrays"

export function enableAllPlugins() {
	enableES5()
	enableMapSet()
	enablePatches()
	enableTypedArrays()
}
