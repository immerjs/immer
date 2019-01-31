import * as legacyProxy from "./es5"
import * as modernProxy from "./proxy"
import {applyPatches, generatePatches} from "./patches"
import {
    assign,
    each,
    has,
    is,
    isDraft,
    isDraftable,
    isEnumerable,
    shallowCopy,
    DRAFT_STATE,
    NOTHING
} from "./common"
import {ImmerScope} from "./scope"

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

        // Only plain objects, arrays, and "immerable classes" are drafted.
        if (isDraftable(base)) {
            const scope = ImmerScope.enter()
            const baseDraft = this.createDraft(base)
            try {
                result = recipe.call(baseDraft, baseDraft)
            } catch (error) {
                scope.revoke()
                throw error
            }
            scope.leave()
            if (result instanceof Promise) {
                return result.then(
                    result => {
                        scope.usePatches(patchListener)
                        return this.processResult(result, scope)
                    },
                    error => {
                        scope.revoke()
                        throw error
                    }
                )
            }
            scope.usePatches(patchListener)
            return this.processResult(result, scope)
        } else {
            result = recipe(base)
            if (result === undefined) return base
            return result !== NOTHING ? result : undefined
        }
    }
    setAutoFreeze(value) {
        this.autoFreeze = value
    }
    setUseProxies(value) {
        this.useProxies = value
        assign(this, value ? modernProxy : legacyProxy)
    }
    applyPatches(base, patches) {
        // Mutate the base state when a draft is passed.
        if (isDraft(base)) {
            return applyPatches(base, patches)
        }
        // Otherwise, produce a copy of the base state.
        return this.produce(base, draft => applyPatches(draft, patches))
    }
    /** @internal */
    processResult(result, scope) {
        const baseDraft = scope.drafts[0]
        const isReplaced = result !== undefined && result !== baseDraft
        this.willFinalize(scope, result, isReplaced)
        if (isReplaced) {
            if (baseDraft[DRAFT_STATE].modified) {
                scope.revoke()
                throw new Error("An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.") // prettier-ignore
            }
            if (isDraftable(result)) {
                // Finalize the result in case it contains (or is) a subset of the draft.
                result = this.finalize(result, null, scope)
            }
            if (scope.patches) {
                scope.patches.push({
                    op: "replace",
                    path: [],
                    value: result
                })
                scope.inversePatches.push({
                    op: "replace",
                    path: [],
                    value: baseDraft[DRAFT_STATE].base
                })
            }
        } else {
            // Finalize the base draft.
            result = this.finalize(baseDraft, [], scope)
        }
        scope.revoke()
        if (scope.patches) {
            scope.patchListener(scope.patches, scope.inversePatches)
        }
        return result !== NOTHING ? result : undefined
    }
    /**
     * @internal
     * Finalize a draft, returning either the unmodified base state or a modified
     * copy of the base state.
     */
    finalize(draft, path, scope) {
        const state = draft[DRAFT_STATE]
        if (!state) {
            if (Object.isFrozen(draft)) return draft
            return this.finalizeTree(draft, null, scope)
        }
        // Never finalize drafts owned by another scope.
        if (state.scope !== scope) {
            return draft
        }
        if (!state.modified) {
            return state.base
        }
        if (!state.finalized) {
            state.finalized = true
            this.finalizeTree(state.draft, path, scope)

            if (this.onDelete) {
                // The `assigned` object is unreliable with ES5 drafts.
                if (this.useProxies) {
                    const {assigned} = state
                    for (const prop in assigned) {
                        if (!assigned[prop]) this.onDelete(state, prop)
                    }
                } else {
                    const {base, copy} = state
                    each(base, prop => {
                        if (!has(copy, prop)) this.onDelete(state, prop)
                    })
                }
            }
            if (this.onCopy) {
                this.onCopy(state)
            }

            // Nested producers must never auto-freeze their result,
            // because it may contain drafts from parent producers.
            if (this.autoFreeze && !scope.parent) {
                Object.freeze(state.copy)
            }

            if (path && scope.patches) {
                generatePatches(
                    state,
                    path,
                    scope.patches,
                    scope.inversePatches
                )
            }
        }
        return state.copy
    }
    /**
     * @internal
     * Finalize all drafts in the given state tree.
     */
    finalizeTree(root, path, scope) {
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
                const needPatches =
                    inDraft && path && scope.patches && !state.assigned[prop]

                value = this.finalize(
                    value,
                    needPatches ? path.concat(prop) : null,
                    scope
                )

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
                each(value, finalizeProperty)
            }

            if (inDraft && onAssign) {
                onAssign(state, prop, value)
            }
        }

        each(root, finalizeProperty)
        return root
    }
}
