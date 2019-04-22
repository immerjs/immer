import {each, isMap, isSet} from "./common"

export function generatePatches(state, basePath, patches, inversePatches) {
    const generatePatchesFn = Array.isArray(state.base)
        ? generateArrayPatches
        : isMap(state.base)
        ? generatePatchesFromAssigned(
              (map, key) => map.get(key),
              (map, key) => map.has(key)
          )
        : isSet(state.base)
        ? generateSetPatches
        : generatePatchesFromAssigned(
              (obj, key) => obj[key],
              (obj, key) => key in obj
          )

    generatePatchesFn(state, basePath, patches, inversePatches)
}

function generateArrayPatches(
    state,
    basePath,
    patches,
    inversePatches,
    isSet = false
) {
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

    const useRemove = end != base.length || isSet
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
            const removePatchData = {
                op: "remove",
                path
            }
            if (isSet) {
                removePatchData.value = copy[i]
            }
            inversePatches.push(removePatchData)
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

function generatePatchesFromAssigned(getValueByKey, hasKey) {
    return function(state, basePath, patches, inversePatches) {
        const {base, copy} = state
        each(state.assigned, (key, assignedValue) => {
            const origValue = getValueByKey(base, key)
            const value = getValueByKey(copy, key)
            const op = !assignedValue
                ? "remove"
                : hasKey(base, key)
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
}

function generateSetPatches(state, basePath, patches, inversePatches) {
    const {base, copy} = state
    return generateArrayPatches(
        {
            base: [...base],
            copy: [...copy],
            assigned: {}
        },
        basePath,
        patches,
        inversePatches,
        true
    )
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
                if (isMap(base.base)) {
                    base = base.get(path[i])
                } else {
                    base = base[path[i]]
                }
                if (!base || typeof base !== "object")
                    throw new Error("Cannot apply patch, path doesn't resolve: " + path.join("/")) // prettier-ignore
            }
            const key = path[path.length - 1]

            const replace = (key, value) => {
                if (isMap(base.base)) {
                    base.set(key, value)
                    return
                }
                if (isSet(base.base)) {
                    throw new Error('Sets cannot have "replace" patches.')
                }
                base[key] = value
            }
            const add = (key, value) =>
                Array.isArray(base)
                    ? base.splice(key, 0, value)
                    : isMap(base.base)
                    ? base.set(key, value)
                    : isSet(base.base)
                    ? base.add(value)
                    : (base[key] = value)
            const remove = (key, value) =>
                Array.isArray(base)
                    ? base.splice(key, 1)
                    : isMap(base.base)
                    ? base.delete(key)
                    : isSet(base.base)
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
