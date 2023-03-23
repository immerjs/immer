import {ImmerState, Patch, die} from "../internal"

/** Plugin utilities */
const plugins: {
	Patches?: {
		generatePatches_(
			state: ImmerState,
			basePath: PatchPath,
			patches: Patch[],
			inversePatches: Patch[]
		): void
		generateReplacementPatches_(
			base: any,
			replacement: any,
			patches: Patch[],
			inversePatches: Patch[]
		): void
		applyPatches_<T>(draft: T, patches: Patch[]): T
	}
} = {}

type Plugins = typeof plugins

export function getPlugin<K extends keyof Plugins>(
	pluginKey: K
): Exclude<Plugins[K], undefined> {
	const plugin = plugins[pluginKey]
	if (!plugin) {
		die(18, pluginKey)
	}
	// @ts-ignore
	return plugin
}

export function loadPlugin<K extends keyof Plugins>(
	pluginKey: K,
	implementation: Plugins[K]
): void {
	if (!plugins[pluginKey]) plugins[pluginKey] = implementation
}

/** Patches plugin */

export type PatchPath = (string | number)[]
