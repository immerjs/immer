import {
	Patch,
	PatchListener,
	Drafted,
	Immer,
	DRAFT_STATE,
	ImmerState,
	ProxyTypeProxyObject,
	ProxyTypeProxyArray
} from "../internal"

/** Each scope represents a `produce` call. */
// TODO: non-class?
export class ImmerScope {
	static current_?: ImmerScope

	patches_?: Patch[]
	inversePatches_?: Patch[]
	canAutoFreeze_: boolean
	drafts_: any[]
	parent_?: ImmerScope
	patchListener_?: PatchListener
	immer_: Immer
	unfinalizedDrafts_ = 0

	constructor(parent: ImmerScope | undefined, immer: Immer) {
		this.drafts_ = []
		this.parent_ = parent
		this.immer_ = immer

		// Whenever the modified draft contains a draft from another scope, we
		// need to prevent auto-freezing so the unowned draft can be finalized.
		this.canAutoFreeze_ = true
	}

	usePatches_(patchListener?: PatchListener) {
		if (patchListener) {
			this.patches_ = []
			this.inversePatches_ = []
			this.patchListener_ = patchListener
		}
	}

	revoke_() {
		this.leave_()
		this.drafts_.forEach(revoke)
		// @ts-ignore
		this.drafts_ = null
	}

	leave_() {
		if (this === ImmerScope.current_) {
			ImmerScope.current_ = this.parent_
		}
	}

	static enter_(immer: Immer) {
		const scope = new ImmerScope(ImmerScope.current_, immer)
		ImmerScope.current_ = scope
		return scope
	}
}

function revoke(draft: Drafted) {
	const state: ImmerState = draft[DRAFT_STATE]
	if (
		state.type_ === ProxyTypeProxyObject ||
		state.type_ === ProxyTypeProxyArray
	)
		state.revoke_()
	else state.revoked_ = true
}
