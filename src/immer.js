import * as legacyProxy from "./es5"
import * as modernProxy from "./proxy"
import {applyPatches, generatePatches} from "./patches"
import {
    assign,
    each,
    get,
    has,
    is,
    isDraft,
    isDraftable,
    isEnumerable,
    isMap,
    shallowCopy,
    DRAFT_STATE,
    NOTHING,
    isSet,
    original
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

            const self = this
            return function curriedProduce(base = defaultBase, ...args) {
                return self.produce(base, draft => recipe.call(this, draft, ...args)) // prettier-ignore
            }
        }

        // prettier-ignore
        {
            if (typeof recipe !== "function") {
                throw new Error("The first or second argument to `produce` must be a function")
            }
            if (patchListener !== undefined && typeof patchListener !== "function") {
                throw new Error("The third argument to `produce` must be a function or undefined")
            }
        }

        let result

        // Only plain objects, arrays, and "immerable classes" are drafted.
        if (isDraftable(base)) {
            const scope = ImmerScope.enter()
            const proxy = this.createProxy(base)
            let hasError = true
            try {
                result = recipe(proxy)
                hasError = false
            } finally {
                // finally instead of catch + rethrow better preserves original stack
                if (hasError) scope.revoke()
                else scope.leave()
            }
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
    createDraft(base) {
        if (!isDraftable(base)) {
            throw new Error("First argument to `createDraft` must be a plain object, an array, or an immerable object") // prettier-ignore
        }
        const scope = ImmerScope.enter()
        const proxy = this.createProxy(base)
        proxy[DRAFT_STATE].isManual = true
        scope.leave()
        return proxy
    }
    finishDraft(draft, patchListener) {
        const state = draft && draft[DRAFT_STATE]
        if (!state || !state.isManual) {
            throw new Error("First argument to `finishDraft` must be a draft returned by `createDraft`") // prettier-ignore
        }
        if (state.finalized) {
            throw new Error("The given draft is already finalized") // prettier-ignore
        }
        const {scope} = state
        scope.usePatches(patchListener)
        return this.processResult(undefined, scope)
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

            // TODO: It won't fire for Sets because they don't use `assigned`. Is it an issue?
            if (this.onDelete) {
                // The `assigned` object is unreliable with ES5 drafts.
                if (this.useProxies) {
                    const {assigned} = state
                    each(assigned, (prop, assignedValue) => {
                        if (!assignedValue) this.onDelete(state, prop)
                    })
                } else {
                    // TODO: Figure it out for Maps and Sets if we need to support ES5
                    const {base, copy} = state
                    each(base, prop => {
                        if (!has(copy, prop)) this.onDelete(state, prop)
                    })
                }
            }
            if (this.onCopy) {
                this.onCopy(state)
            }

            // At this point, all descendants of `state.copy` have been finalized,
            // so we can be sure that `scope.canAutoFreeze` is accurate.
            if (this.autoFreeze && scope.canAutoFreeze) {
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
    finalizeTree(root, rootPath, scope) {
        const state = root[DRAFT_STATE]
        if (state) {
            if (!this.useProxies) {
                // Create the final copy, with added keys and without deleted keys.
                state.copy = shallowCopy(state.draft, true)
            }
            root = state.copy
        }

        const needPatches = !!rootPath && !!scope.patches
        const finalizeProperty = (prop, value, parent) => {
            if (value === parent) {
                throw Error("Immer forbids circular references")
            }

            // In the `finalizeTree` method, only the `root` object may be a draft.
            const isDraftProp = !!state && parent === root
            const isSetMember = isSet(parent)

            if (isDraft(value)) {
                const path =
                    isDraftProp &&
                    needPatches &&
                    !isSetMember &&
                    !has(state.assigned, prop)
                        ? rootPath.concat(prop)
                        : null

                // Drafts owned by `scope` are finalized here.
                value = this.finalize(value, path, scope)

                // Drafts from another scope must prevent auto-freezing.
                if (isDraft(value)) {
                    scope.canAutoFreeze = false
                }

                setProperty(parent, prop, value)

                // Unchanged drafts are never passed to the `onAssign` hook.
                // TODO: Add tests and support for Sets
                if (isDraftProp && value === get(state.base, prop)) return
            }
            // Unchanged draft properties are ignored.
            else if (isDraftProp && is(value, get(state.base, prop))) {
                return
            }
            // Search new objects for unfinalized drafts. Frozen objects should never contain drafts.
            else if (isDraftable(value) && !Object.isFrozen(value)) {
                each(value, finalizeProperty)
            }

            // We cannot really assign anything inside of a Set. We can only replace the whole Set.
            if (isDraftProp && this.onAssign && !isSetMember) {
                this.onAssign(state, prop, value)
            }
        }

        each(root, finalizeProperty)
        return root
    }
}

function setProperty(parent, prop, value) {
    // Preserve non-enumerable properties.
    if (Array.isArray(parent) || isEnumerable(parent, prop)) {
        parent[prop] = value
        return
    }
    if (isMap(parent)) {
        parent.set(prop, value)
        return
    }
    if (isSet(parent)) {
        // Here prop is a proxied value
        parent.delete(prop)
        parent.add(value)
        return
    }
    Object.defineProperty(parent, prop, {value})
}
