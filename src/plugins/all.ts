import {enableES5} from "./es5"
import {enableMapSet} from "./mapset"
import {enablePatches} from "./patches"

/*#__PURE__*/
export function enableAllPlugins() {
	enableES5()
	enableMapSet()
	enablePatches()
}
