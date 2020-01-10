import {
	Patch,
	PatchListener,
	Drafted,
	ProxyType,
	Immer,
	DRAFT_STATE
} from "./internal"

/** Each scope represents a `produce` call. */
export class ImmerScope {
	static current?: ImmerScope

	patches?: Patch[]
	inversePatches?: Patch[]
	canAutoFreeze: boolean
	drafts: any[]
	parent?: ImmerScope
	patchListener?: PatchListener
	immer: Immer

	constructor(parent: ImmerScope | undefined, immer: Immer) {
		this.drafts = []
		this.parent = parent
		this.immer = immer

		// Whenever the modified draft contains a draft from another scope, we
		// need to prevent auto-freezing so the unowned draft can be finalized.
		this.canAutoFreeze = true
	}

	usePatches(patchListener?: PatchListener) {
		if (patchListener) {
			this.patches = []
			this.inversePatches = []
			this.patchListener = patchListener
		}
	}

	revoke() {
		this.leave()
		this.drafts.forEach(revoke)
		// @ts-ignore
		this.drafts = null
	}

	leave() {
		if (this === ImmerScope.current) {
			ImmerScope.current = this.parent
		}
	}

	static enter(immer: Immer) {
		const scope = new ImmerScope(ImmerScope.current, immer)
		ImmerScope.current = scope
		return scope
	}
}

function revoke(draft: Drafted) {
	const state = draft[DRAFT_STATE]
	if (
		state.type === ProxyType.ProxyObject ||
		state.type === ProxyType.ProxyArray
	)
		state.revoke()
	else state.revoked = true
}
