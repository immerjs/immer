import {each} from "./common"

export function generatePatches(
    state,
    basepath,
    patches,
    inversePatches,
    baseValue,
    resultValue
) {
    if (patches)
        if (Array.isArray(baseValue))
            generateArrayPatches(
                state,
                basepath,
                patches,
                inversePatches,
                baseValue,
                resultValue
            )
        else
            generateObjectPatches(
                state,
                basepath,
                patches,
                inversePatches,
                baseValue,
                resultValue
            )
}

export function generateArrayPatches(
    state,
    basepath,
    patches,
    inversePatches,
    baseValue,
    resultValue
) {
    const shared = Math.min(baseValue.length, resultValue.length)
    for (let i = 0; i < shared; i++) {
        if (state.assigned[i] && baseValue[i] !== resultValue[i]) {
            const path = basepath.concat(i)
            patches.push({op: "replace", path, value: resultValue[i]})
            inversePatches.push({op: "replace", path, value: baseValue[i]})
        }
    }
    if (shared < resultValue.length) {
        // stuff was added
        for (let i = shared; i < resultValue.length; i++) {
            const path = basepath.concat(i)
            patches.push({op: "add", path, value: resultValue[i]})
        }
        inversePatches.push({
            op: "replace",
            path: basepath.concat("length"),
            value: baseValue.length
        })
    } else if (shared < baseValue.length) {
        // stuff was removed
        patches.push({
            op: "replace",
            path: basepath.concat("length"),
            value: resultValue.length
        })
        for (let i = shared; i < baseValue.length; i++) {
            const path = basepath.concat(i)
            inversePatches.push({op: "add", path, value: baseValue[i]})
        }
    }
}

function generateObjectPatches(
    state,
    basepath,
    patches,
    inversePatches,
    baseValue,
    resultValue
) {
    each(state.assigned, (key, assignedValue) => {
        const origValue = baseValue[key]
        const value = resultValue[key]
        const op = !assignedValue
            ? "remove"
            : key in baseValue
                ? "replace"
                : "add"
        if (origValue === baseValue && op === "replace") return
        const path = basepath.concat(key)
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

export function applyPatch(draft, patch) {
    const {path} = patch
    if (path.length === 0) {
        if (patch.op === "replace") {
            return patch.value
        }
        throw new Error("Cannot apply patch, empty path can only be replace")
    }
    let base = draft
    for (let i = 0; i < path.length - 1; i++) {
        base = base[path[i]]
        if (!base || typeof base !== "object")
            throw new Error(
                "Cannot apply patch, path doesn't resolve: " + path.join("/")
            )
    }
    const key = path[path.length - 1]
    switch (patch.op) {
        case "add":
            if (Array.isArray(base)) {
                if (key === "-") {
                    base.push(patch.value)
                    break
                }
                const index = Number(key)
                if (!Number.isNaN(index)) {
                    if (index < 0) {
                        throw new Error(
                            `Invalid array patch: Cannot add a negative index`
                        )
                    }
                    if (index > base.length) {
                        throw new Error(
                            `Invalid array patch: Adding the given index would create a sparse array`
                        )
                    }
                    if (index === 0) {
                        base.unshift(patch.value)
                        break
                    }
                    if (index !== base.length - 1) {
                        base.splice(index, 0, patch.value)
                        break
                    }
                }
            }
        case "replace":
            base[key] = patch.value
            break
        case "remove":
            if (Array.isArray(base)) {
                const index = Number(key)
                if (!Number.isNaN(index)) {
                    if (index === 0) {
                        base.shift()
                        break
                    }
                    if (index !== base.length - 1) {
                        base.splice(index, 1)
                        break
                    }
                    base.pop()
                    break
                }
            }
            delete base[key]
            break
        default:
            throw new Error("Unsupported patch operation: " + patch.op)
    }
    return draft
}

export function applyPatches(draft, patches) {
    let result = draft
    for (let i = 0; i < patches.length; i++) {
        result = applyPatch(result, patches[i])
    }
    return result
}
