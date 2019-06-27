import {DRAFT_STATE} from "./common"

/** Each scope represents a `produce` call. */
export class ImmerScope {
	constructor(parent) {
		this.drafts = []
		this.parent = parent

		// Whenever the modified draft contains a draft from another scope, we
		// need to prevent auto-freezing so the unowned draft can be finalized.
		this.canAutoFreeze = true

		// To avoid prototype lookups:
		this.patches = null
	}
	usePatches(patchListener) {
		if (patchListener) {
			this.patches = []
			this.inversePatches = []
			this.patchListener = patchListener
		}
	}
	revoke() {
		this.leave()
		this.drafts.forEach(revoke)
		this.drafts = null // Make draft-related methods throw.
	}
	leave() {
		if (this === ImmerScope.current) {
			ImmerScope.current = this.parent
		}
	}
}

ImmerScope.current = null
ImmerScope.enter = function() {
	return (this.current = new ImmerScope(this.current))
}

function revoke(draft) {
	draft[DRAFT_STATE].revoke()
}
