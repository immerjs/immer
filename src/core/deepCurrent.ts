import {
    die,
    isDraft,
    shallowCopy,
    each,
    DRAFT_STATE,
    set,
    ImmerState,
    isDraftable,
    isFrozen
} from "../internal"

// Extend the current function to handle deep drafts
export function deepCurrent<T>(value: T): T
export function deepCurrent(value: any): any {
    if (!isDraft(value)) die(10, value) // Use Immer's error handling
    return deepCurrentImpl(value)
}

function deepCurrentImpl(value: any): any {
    if (!isDraftable(value) || isFrozen(value)) return value // Base case for recursion
    
    const state: ImmerState | undefined = value[DRAFT_STATE]
    let copy: any
    if (state) {
        // State exists: the object is a draft
        if (!state.modified_) return state.base_ // If not modified, return base
        state.finalized_ = true // Mark as finalized to prevent new drafts during copy
        copy = shallowCopy(value, state.scope_.immer_.useStrictShallowCopy_)
    } else {
        // No state: value is not a draft, perform a shallow copy
        copy = shallowCopy(value, true)
    }

    // Recursively apply deepCurrentImpl to each property
    each(copy, (key, childValue) => {
        set(copy, key, deepCurrentImpl(childValue)) // Recurse into children
    })

    // Revert the finalized flag after recursion
    if (state) {
        state.finalized_ = false
    }
    return copy
}