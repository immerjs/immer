import {DRAFT_STATE} from "./common"
import {ImmerState, Patch, PatchListener} from "./types"

/** Each scope represents a `produce` call. */
export class ImmerScope {
	static current?: ImmerScope

	patches?: Patch[]
	inversePatches?: Patch[]
	canAutoFreeze: boolean
	drafts?: any[]
	parent?: ImmerScope
	patchListener?: PatchListener

	constructor(parent?: ImmerScope) {
		this.drafts = []
		this.parent = parent

		// Whenever the modified draft contains a draft from another scope, we
		// need to prevent auto-freezing so the unowned draft can be finalized.
		this.canAutoFreeze = true

		// To avoid prototype lookups:
		this.patches = undefined
	}

	usePatches(patchListener: PatchListener) {
		if (patchListener) {
			this.patches = []
			this.inversePatches = []
			this.patchListener = patchListener
		}
	}

	revoke() {
		this.leave()
		this.drafts!.forEach(revoke)
		this.drafts = undefined // Make draft-related methods throw.
	}

	leave() {
		if (this === ImmerScope.current) {
			ImmerScope.current = this.parent
		}
	}

	static enter() {
		return (ImmerScope.current = new ImmerScope(ImmerScope.current))
	}
}

function revoke(draft) {
	draft[DRAFT_STATE].revoke()
}
