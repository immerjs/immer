import {enableMapSet} from "./mapset"
import {enablePatches} from "./patches"

export function enableAllPlugins() {
	enableMapSet()
	enablePatches()
}
