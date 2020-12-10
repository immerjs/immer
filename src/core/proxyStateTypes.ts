import {
	ProxyTypeProxyArray,
	ImmerState,
	ProxyTypeProxyObject,
	AnyArray,
	Drafted,
	AnyObject,
	ImmerBaseState
} from "../internal"

export type ProxyState = ProxyObjectState | ProxyArrayState

export interface ProxyBaseState extends ImmerBaseState {
	assigned_: {
		[property: string]: boolean
	}
	parent_?: ImmerState
	revoke_(): void
}

export interface ProxyObjectState extends ProxyBaseState {
	type_: typeof ProxyTypeProxyObject
	base_: any
	copy_: any
	draft_: Drafted<AnyObject, ProxyObjectState>
}

export interface ProxyArrayState extends ProxyBaseState {
	type_: typeof ProxyTypeProxyArray
	base_: AnyArray
	copy_: AnyArray | null
	draft_: Drafted<AnyArray, ProxyArrayState>
}
