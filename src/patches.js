import {each} from "./common"

export function generatePatches(...args) {
    Array.isArray(args[0].base)
        ? generateArrayPatches(...args)
        : generateObjectPatches(...args)
}

export function generateArrayPatches(state, basePath, patches, inversePatches) {
    const {base, copy, assigned} = state
    const minLength = Math.min(base.length, copy.length)

    // Look for replaced indices.
    for (let i = 0; i < minLength; i++) {
        if (assigned[i] && base[i] !== copy[i]) {
            const path = basePath.concat(i)
            patches.push({op: "replace", path, value: copy[i]})
            inversePatches.push({op: "replace", path, value: base[i]})
        }
    }

    // Did the array expand?
    if (minLength < copy.length) {
        for (let i = minLength; i < copy.length; i++) {
            patches.push({
                op: "add",
                path: basePath.concat(i),
                value: copy[i]
            })
        }
        inversePatches.push({
            op: "replace",
            path: basePath.concat("length"),
            value: base.length
        })
    }

    // ...or did it shrink?
    else if (minLength < base.length) {
        patches.push({
            op: "replace",
            path: basePath.concat("length"),
            value: copy.length
        })
        for (let i = minLength; i < base.length; i++) {
            inversePatches.push({
                op: "add",
                path: basePath.concat(i),
                value: base[i]
            })
        }
    }
}

function generateObjectPatches(state, basePath, patches, inversePatches) {
    const {base, copy} = state
    each(state.assigned, (key, assignedValue) => {
        const origValue = base[key]
        const value = copy[key]
        const op = !assignedValue ? "remove" : key in base ? "replace" : "add"
        if (origValue === base && op === "replace") return
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
                case "add":
                    // TODO: add support is not extensive, it does not support insertion or `-` atm!
                    base[key] = patch.value
                    break
                case "remove":
                    if (Array.isArray(base)) {
                        if (key !== base.length - 1)
                            throw new Error(`Only the last index of an array can be removed, index: ${key}, length: ${base.length}`) // prettier-ignore
                        base.length -= 1
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
