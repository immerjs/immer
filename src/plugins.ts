import {
	ImmerState,
	Patch,
	ImmerScope,
	Drafted,
	AnyObject,
	ImmerBaseState,
	AnyArray,
	AnyMap,
	AnySet,
	ProxyTypeES5Array,
	ProxyTypeES5Object,
	ProxyTypeMap,
	ProxyTypeSet
} from "./internal"

/** Plugin utilities */
const plugins: {
	patches?: {
		generatePatches: typeof generatePatches
		applyPatches: typeof applyPatches
	}
	es5?: {
		willFinalizeES5: typeof willFinalizeES5
		createES5Proxy: typeof createES5Proxy
		markChangedES5: typeof markChangedES5
	}
	mapset?: {
		proxyMap: typeof proxyMap
		proxySet: typeof proxySet
	}
} = {}

type Plugins = typeof plugins

export function getPlugin<K extends keyof Plugins>(
	pluginKey: K
): Exclude<Plugins[K], undefined> {
	const plugin = plugins[pluginKey]
	if (!plugin) {
		throw new Error(
			`The plugin ${pluginKey} has not been loaded into Immer. Make sure to call "enable${pluginKey[0].toUpperCase()}${pluginKey.substr(
				1
			)}()" when initializing your application, just after requiring immer itself.`
		)
	}
	// @ts-ignore
	return plugin
}

export function loadPlugin<K extends keyof Plugins>(
	pluginKey: K,
	implementation: Plugins[K]
): void {
	plugins[pluginKey] = implementation
}

/** ES5 Plugin */

interface ES5BaseState extends ImmerBaseState {
	finalizing_: boolean
	assigned_: {[key: string]: any}
	parent_?: ImmerState
	revoked_: boolean
}

export interface ES5ObjectState extends ES5BaseState {
	type_: typeof ProxyTypeES5Object
	draft_: Drafted<AnyObject, ES5ObjectState>
	base_: AnyObject
	copy_: AnyObject | null
}

export interface ES5ArrayState extends ES5BaseState {
	type_: typeof ProxyTypeES5Array
	draft_: Drafted<AnyObject, ES5ArrayState>
	base_: AnyArray
	copy_: AnyArray | null
}

export function willFinalizeES5(
	scope: ImmerScope,
	result: any,
	isReplaced: boolean
) {
	getPlugin("es5").willFinalizeES5(scope, result, isReplaced)
}

export function createES5Proxy<T>(
	base: T,
	parent?: ImmerState
): Drafted<T, ES5ObjectState | ES5ArrayState> {
	return getPlugin("es5").createES5Proxy(base, parent)
}

export function markChangedES5(state: ImmerState) {
	getPlugin("es5").markChangedES5(state)
}

/** Map / Set plugin */

export interface MapState extends ImmerBaseState {
	type_: typeof ProxyTypeMap
	copy_: AnyMap | undefined
	assigned_: Map<any, boolean> | undefined
	base_: AnyMap
	revoked_: boolean
	draft_: Drafted<AnyMap, MapState>
}

export interface SetState extends ImmerBaseState {
	type_: typeof ProxyTypeSet
	copy_: AnySet | undefined
	base_: AnySet
	drafts_: Map<any, Drafted> // maps the original value to the draft value in the new set
	revoked_: boolean
	draft_: Drafted<AnySet, SetState>
}

export function proxyMap<T extends AnyMap>(target: T, parent?: ImmerState): T {
	return getPlugin("mapset").proxyMap(target, parent)
}

export function proxySet<T extends AnySet>(target: T, parent?: ImmerState): T {
	return getPlugin("mapset").proxySet(target, parent)
}

/** Patches plugin */

export type PatchPath = (string | number)[]

export function generatePatches(
	state: ImmerState,
	basePath: PatchPath,
	patches: Patch[],
	inversePatches: Patch[]
): void {
	getPlugin("patches").generatePatches(state, basePath, patches, inversePatches)
}

export function applyPatches<T>(draft: T, patches: Patch[]): T {
	return getPlugin("patches").applyPatches(draft, patches)
}
