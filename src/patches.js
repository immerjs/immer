import {each} from "./common"

export function generatePatches(state, basePath, patches, inversePatches) {
    Array.isArray(state.base)
        ? generateArrayPatches(state, basePath, patches, inversePatches)
        : generateObjectPatches(state, basePath, patches, inversePatches)
}

function generateArrayPatches(state, basePath, patches, inversePatches) {
    let {base, copy, assigned} = state

    // Guarantee `base` is never longer than `copy`
    if (copy.length < base.length) {
        ;[base, copy] = [copy, base]
        ;[patches, inversePatches] = [inversePatches, patches]
    }

    const delta = copy.length - base.length

    // Find the first changed index.
    let start = 0
    while (base[start] === copy[start] && start < base.length) {
        ++start
    }

    // Find the last changed index.
    let baseEnd = base.length
    while (baseEnd > start && base[baseEnd - 1] === copy[baseEnd + delta - 1]) {
        --baseEnd
    }

    // Look for replaced indices.
    const replaceCount = baseEnd - start
    for (let i = 0; i < replaceCount; ++i) {
        const index = start + i
        const path = basePath.concat([index])
        if (assigned[index] && copy[index] !== base[index]) {
            patches.push({
                op: "replace",
                path,
                value: copy[index]
            })
            inversePatches.push({
                op: "replace",
                path,
                value: base[index]
            })
        }
    }
    start += replaceCount

    // For "add" patches that extend the array, we can use a single "replace"
    // patch (on the `length` property) as the inverse patch, instead of multiple
    // "remove" patches.
    const useRemove = start != base.length
    const replacePatchesCount = patches.length
    for (let i = delta - 1; i >= 0; --i) {
        const path = basePath.concat([start + i])
        patches[i + replacePatchesCount] = {
            op: "add",
            path,
            value: copy[start + i]
        }
        if (useRemove) {
            inversePatches.push({
                op: "remove",
                path
            })
        }
    }

    if (!useRemove) {
        inversePatches.push({
            op: "replace",
            path: basePath.concat(["length"]),
            value: base.length
        })
    }
}

function generateObjectPatches(state, basePath, patches, inversePatches) {
    const {base, copy} = state
    each(state.assigned, (key, assignedValue) => {
        const origValue = base[key]
        const value = copy[key]
        const op = !assignedValue ? "remove" : key in base ? "replace" : "add"
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

export function applyPatches(draft, patches) {
    for (let i = 0; i < patches.length; i++) {
        const patch = patches[i]
        const {path} = patch
        if (path.length === 0 && patch.op === "replace") {
            draft = patch.value
        } else {
            let base = draft
            for (let i = 0; i < path.length - 1; i++) {
                base = base[path[i]]
                if (!base || typeof base !== "object")
                    throw new Error("Cannot apply patch, path doesn't resolve: " + path.join("/")) // prettier-ignore
            }
            const key = path[path.length - 1]
            switch (patch.op) {
                case "replace":
                    base[key] = patch.value
                    break
                case "add":
                    if (Array.isArray(base)) {
                        // TODO: support "foo/-" paths for appending to an array
                        base.splice(key, 0, patch.value)
                    } else {
                        base[key] = patch.value
                    }
                    break
                case "remove":
                    if (Array.isArray(base)) {
                        base.splice(key, 1)
                    } else {
                        delete base[key]
                    }
                    break
                default:
                    throw new Error("Unsupported patch operation: " + patch.op)
            }
        }
    }
    return draft
}
