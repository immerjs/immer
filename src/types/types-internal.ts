import {
	SetState,
	ImmerScope,
	ProxyObjectState,
	ProxyArrayState,
	ES5ObjectState,
	ES5ArrayState,
	TypedArrayState,
	MapState,
	DRAFT_STATE
} from "../internal"

export type Objectish = AnyObject | AnyArray | AnyMap | AnySet
export type ObjectishNoSet = AnyObject | AnyArray | AnyMap

export type AnyObject = {[key: string]: any}
export type AnyArray = Array<any>
export type AnySet = Set<any>
export type AnyMap = Map<any, any>
export type AnyTypedArray =
	| Uint8Array
	| Uint8ClampedArray
	| Uint16Array
	| Uint32Array
	| Int8Array
	| Int16Array
	| Int32Array
	| Float32Array
	| Float64Array
	| BigUint64Array
	| BigInt64Array

export const ArchtypeObject = 0
export const ArchtypeArray = 1
export const ArchtypeMap = 2
export const ArchtypeSet = 3
export const ArchtypeTypedArray = 4

export const ProxyTypeProxyObject = 0
export const ProxyTypeProxyArray = 1
export const ProxyTypeES5Object = 5
export const ProxyTypeES5Array = 6
export const ProxyTypeMap = 2
export const ProxyTypeSet = 3
export const ProxyTypeTypedArray = 4

export interface ImmerBaseState {
	parent_?: ImmerState
	scope_: ImmerScope
	modified_: boolean
	finalized_: boolean
	isManual_: boolean
}

export type ImmerState =
	| ProxyObjectState
	| ProxyArrayState
	| ES5ObjectState
	| ES5ArrayState
	| MapState
	| SetState
	| TypedArrayState<AnyTypedArray>

// The _internal_ type used for drafts (not to be confused with Draft, which is public facing)
export type Drafted<Base = any, T extends ImmerState = ImmerState> = {
	[DRAFT_STATE]: T
} & Base
