import {StrictMode} from "../internal"

export const DEFAULT_AUTOFREEZE = true
export const DEFAULT_USE_STRICT_SHALLOW_COPY = false

export interface ImmerContext {
	autoFreeze_: boolean
	useStrictShallowCopy_: StrictMode
}

export function createImmerContext(): ImmerContext {
	return {
		autoFreeze_: DEFAULT_AUTOFREEZE,
		useStrictShallowCopy_: DEFAULT_USE_STRICT_SHALLOW_COPY
	}
}
