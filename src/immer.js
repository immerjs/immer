import * as legacyProxy from "./es5"
import * as modernProxy from "./proxy"
import {generatePatches} from "./patches"
import {
    assign,
    each,
    is,
    isDraft,
    isDraftable,
    shallowCopy,
    DRAFT_STATE,
    NOTHING,
    isEnumerable,
    eachOwn
} from "./common"

function verifyMinified() {}

const configDefaults = {
    useProxies: typeof Proxy !== "undefined" && typeof Reflect !== "undefined",
    autoFreeze:
        typeof process !== "undefined"
            ? process.env.NODE_ENV !== "production"
            : verifyMinified.name === "verifyMinified",
    onAssign: null,
    onDelete: null,
    onCopy: null
}

export class Immer {
    constructor(config) {
        assign(this, configDefaults, config)
        this.setUseProxies(this.useProxies)
        this.produce = this.produce.bind(this)
    }
    produce(base, recipe, patchListener) {
        // curried invocation
        if (typeof base === "function" && typeof recipe !== "function") {
            const defaultBase = recipe
            recipe = base

            // prettier-ignore
            return (base = defaultBase, ...args) =>
                this.produce(base, draft => recipe.call(draft, draft, ...args))
        }

        // prettier-ignore
        {
            if (typeof recipe !== "function") throw new Error("if first argument is not a function, the second argument to produce should be a function")
            if (patchListener !== undefined && typeof patchListener !== "function") throw new Error("the third argument of a producer should not be set or a function")
        }

        let result
        // Only create proxies for plain objects/arrays.
        if (!isDraftable(base)) {
            result = recipe(base)
            if (result === undefined) return base
        }
        // The given value must be proxied.
        else {
            this.scopes.push([])
            const baseDraft = this.createDraft(base)
            try {
                result = recipe.call(baseDraft, baseDraft)
                this.willFinalize(result, baseDraft, !!patchListener)

                // Never generate patches when no listener exists.
                var patches = patchListener && [],
                    inversePatches = patchListener && []

                // Finalize the modified draft...
                if (result === undefined || result === baseDraft) {
                    result = this.finalize(
                        baseDraft,
                        [],
                        patches,
                        inversePatches
                    )
                }
                // ...or use a replacement value.
                else {
                    // Users must never modify the draft _and_ return something else.
                    if (baseDraft[DRAFT_STATE].modified)
                        throw new Error("An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.") // prettier-ignore

                    // Finalize the replacement in case it contains (or is) a subset of the draft.
                    if (isDraftable(result)) result = this.finalize(result)

                    if (patchListener) {
                        patches.push({
                            op: "replace",
                            path: [],
                            value: result
                        })
                        inversePatches.push({
                            op: "replace",
                            path: [],
                            value: base
                        })
                    }
                }
            } finally {
                this.currentScope().forEach(state => state.revoke())
                this.scopes.pop()
            }
            patchListener && patchListener(patches, inversePatches)
        }
        // Normalize the result.
        return result === NOTHING ? undefined : result
    }
    setAutoFreeze(value) {
        this.autoFreeze = value
    }
    setUseProxies(value) {
        this.useProxies = value
        assign(this, value ? modernProxy : legacyProxy)
    }
    /**
     * @internal
     * Finalize a draft, returning either the unmodified base state or a modified
     * copy of the base state.
     */
    finalize(draft, path, patches, inversePatches) {
        const state = draft[DRAFT_STATE]
        if (!state) {
            if (Object.isFrozen(draft)) return draft
            return this.finalizeTree(draft)
        }
        // Never finalize drafts owned by an outer scope.
        if (state.scope !== this.currentScope()) {
            return draft
        }
        if (!state.modified) return state.base
        if (!state.finalized) {
            state.finalized = true
            this.finalizeTree(state.draft, path, patches, inversePatches)
            if (this.onDelete) {
                const {assigned} = state
                for (const prop in assigned)
                    assigned[prop] || this.onDelete(state, prop)
            }
            if (this.onCopy) this.onCopy(state)

            // Nested producers must never auto-freeze their result,
            // because it may contain drafts from parent producers.
            if (this.autoFreeze && this.scopes.length === 1) {
                Object.freeze(state.copy)
            }

            if (patches) generatePatches(state, path, patches, inversePatches)
        }
        return state.copy
    }
    /**
     * @internal
     * Finalize all drafts in the given state tree.
     */
    finalizeTree(root, path, patches, inversePatches) {
        const state = root[DRAFT_STATE]
        if (state) {
            if (!this.useProxies) {
                state.finalizing = true
                state.copy = shallowCopy(state.draft, true)
                state.finalizing = false
            }
            root = state.copy
        }

        const {onAssign} = this
        const finalizeProperty = (prop, value, parent) => {
            if (value === parent) {
                throw Error("Immer forbids circular references")
            }

            // The only possible draft (in the scope of a `finalizeTree` call) is the `root` object.
            const inDraft = !!state && parent === root

            if (isDraft(value)) {
                value =
                    // Patches are never generated for assigned properties.
                    patches && inDraft && !state.assigned[prop]
                        ? this.finalize(value, path.concat(prop), patches, inversePatches) // prettier-ignore
                        : this.finalize(value)

                // Preserve non-enumerable properties.
                if (Array.isArray(parent) || isEnumerable(parent, prop)) {
                    parent[prop] = value
                } else {
                    Object.defineProperty(parent, prop, {value})
                }

                // Unchanged drafts are never passed to the `onAssign` hook.
                if (inDraft && value === state.base[prop]) return
            }
            // Unchanged draft properties are ignored.
            else if (inDraft && is(value, state.base[prop])) {
                return
            }
            // Search new objects for unfinalized drafts. Frozen objects should never contain drafts.
            else if (isDraftable(value) && !Object.isFrozen(value)) {
                eachOwn(value, finalizeProperty)
            }

            if (inDraft && onAssign) {
                onAssign(state, prop, value)
            }
        }

        eachOwn(root, finalizeProperty)
        return root
    }
}
