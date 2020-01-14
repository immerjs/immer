import {
	SetState,
	ImmerScope,
	ProxyObjectState,
	ProxyArrayState,
	ES5ObjectState,
	ES5ArrayState,
	MapState,
	DRAFT_STATE
} from "./internal"

export type Objectish = AnyObject | AnyArray | AnyMap | AnySet
export type ObjectishNoSet = AnyObject | AnyArray | AnyMap

export type AnyObject = {[key: string]: any}
export type AnyArray = Array<any>
export type AnySet = Set<any>
export type AnyMap = Map<any, any>
export enum Archtype {
	Object,
	Array,
	Map,
	Set
}

export enum ProxyType {
	ProxyObject,
	ProxyArray,
	ES5Object,
	ES5Array,
	Map,
	Set
}

export interface ImmerBaseState {
	parent?: ImmerState
	scope: ImmerScope
	modified: boolean
	finalized: boolean
	isManual: boolean
}

export type ImmerState =
	| ProxyObjectState
	| ProxyArrayState
	| ES5ObjectState
	| ES5ArrayState
	| MapState
	| SetState

// The _internal_ type used for drafts (not to be confused with Draft, which is public facing)
export type Drafted<Base = any, T extends ImmerState = ImmerState> = {
	[DRAFT_STATE]: T
} & Base
