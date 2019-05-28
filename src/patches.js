import {get, each, isMap, isSet, has} from "./common"

export function generatePatches(state, basePath, patches, inversePatches) {
    const generatePatchesFn = Array.isArray(state.base)
        ? generateArrayPatches
        : isSet(state.base)
        ? generateSetPatches
        : generatePatchesFromAssigned

    generatePatchesFn(state, basePath, patches, inversePatches)
}

function generateArrayPatches(state, basePath, patches, inversePatches) {
    let {base, copy, assigned} = state

    // Reduce complexity by ensuring `base` is never longer.
    if (copy.length < base.length) {
        ;[base, copy] = [copy, base]
        ;[patches, inversePatches] = [inversePatches, patches]
    }

    const delta = copy.length - base.length

    // Find the first replaced index.
    let start = 0
    while (base[start] === copy[start] && start < base.length) {
        ++start
    }

    // Find the last replaced index. Search from the end to optimize splice patches.
    let end = base.length
    while (end > start && base[end - 1] === copy[end + delta - 1]) {
        --end
    }

    // Process replaced indices.
    for (let i = start; i < end; ++i) {
        if (assigned[i] && copy[i] !== base[i]) {
            const path = basePath.concat([i])
            patches.push({
                op: "replace",
                path,
                value: copy[i]
            })
            inversePatches.push({
                op: "replace",
                path,
                value: base[i]
            })
        }
    }

    const useRemove = end != base.length
    const replaceCount = patches.length

    // Process added indices.
    for (let i = end + delta - 1; i >= end; --i) {
        const path = basePath.concat([i])
        patches[replaceCount + i - end] = {
            op: "add",
            path,
            value: copy[i]
        }
        if (useRemove) {
            inversePatches.push({
                op: "remove",
                path
            })
        }
    }

    // One "replace" patch reverses all non-splicing "add" patches.
    if (!useRemove) {
        inversePatches.push({
            op: "replace",
            path: basePath.concat(["length"]),
            value: base.length
        })
    }
}

// This is used for both Map objects and normal objects.
function generatePatchesFromAssigned(state, basePath, patches, inversePatches) {
    const {base, copy} = state
    each(state.assigned, (key, assignedValue) => {
        const origValue = get(base, key)
        const value = get(copy, key)
        const op = !assignedValue
            ? "remove"
            : has(base, key)
            ? "replace"
            : "add"
        if (origValue === value && op === "replace") return
        const path = basePath.concat(key)
        patches.push(op === "remove" ? {op, path} : {op, path, value})
        inversePatches.push(
            op === "add"
                ? {op: "remove", path}
                : op === "remove"
                ? {op: "add", path, value: origValue}
                : {op: "replace", path, value: origValue}
        )
    })
}

function generateSetPatches(state, basePath, patches, inversePatches) {
    let {base, copy} = state

    let i = 0
    for (const value of base) {
        if (!copy.has(value)) {
            const path = basePath.concat([i])
            patches.push({
                op: "remove",
                path,
                value
            })
            inversePatches.unshift({
                op: "add",
                path,
                value
            })
        }
        i++
    }
    i = 0
    for (const value of copy) {
        if (!base.has(value)) {
            const path = basePath.concat([i])
            patches.push({
                op: "add",
                path,
                value
            })
            inversePatches.unshift({
                op: "remove",
                path,
                value
            })
        }
        i++
    }
}

export function applyPatches(draft, patches) {
    for (let i = 0; i < patches.length; i++) {
        const patch = patches[i]
        const {path} = patch
        if (path.length === 0 && patch.op === "replace") {
            draft = patch.value
        } else {
            let base = draft
            for (let i = 0; i < path.length - 1; i++) {
                base = get(base, path[i])
                if (!base || typeof base !== "object")
                    throw new Error("Cannot apply patch, path doesn't resolve: " + path.join("/")) // prettier-ignore
            }
            const key = path[path.length - 1]

            const replace = (key, value) => {
                if (isMap(base)) {
                    base.set(key, value)
                    return
                }
                if (isSet(base)) {
                    throw new Error('Sets cannot have "replace" patches.')
                }
                base[key] = value
            }
            const add = (key, value) =>
                Array.isArray(base)
                    ? base.splice(key, 0, value)
                    : isMap(base)
                    ? base.set(key, value)
                    : isSet(base)
                    ? base.add(value)
                    : (base[key] = value)
            const remove = (key, value) =>
                Array.isArray(base)
                    ? base.splice(key, 1)
                    : isMap(base)
                    ? base.delete(key)
                    : isSet(base)
                    ? base.delete(value)
                    : delete base[key]

            switch (patch.op) {
                case "replace":
                    replace(key, patch.value)
                    break
                case "add":
                    add(key, patch.value)
                    break
                case "remove":
                    remove(key, patch.value)
                    break
                default:
                    throw new Error("Unsupported patch operation: " + patch.op)
            }
        }
    }
    return draft
}
