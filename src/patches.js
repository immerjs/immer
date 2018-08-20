import {each, has, diffKeys, isNonNegativeInteger} from "./common"

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
        if (!has(resultValue, i) && has(baseValue, i)) {
            var path = basepath.concat(i)
            patches.push({op: "remove", path: path})
            inversePatches.push({op: "add", path: path, value: baseValue[i]})
            continue
        }

        if (has(resultValue, i) && !has(baseValue, i)) {
            var path = basepath.concat(i)
            patches.push({op: "add", path: path, value: resultValue[i]})
            inversePatches.push({op: "remove", path: path})
            continue
        }

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

    //handle the non-index keys
    let {added, removed} = diffKeys(baseValue, resultValue)
    added = added.filter(v => !isNonNegativeInteger(v))
    removed = removed.filter(v => !isNonNegativeInteger(v))
    each(added, (_, key) => {
        const path = basepath.concat(key)
        patches.push({op: "add", path: path, value: resultValue[key]})
        inversePatches.push({op: "remove", path: path})
    })
    each(removed, (_, key) => {
        const path = basepath.concat(key)
        patches.push({op: "remove", path: path})
        inversePatches.push({op: "add", path: path, value: baseValue[key]})
    })
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

export function applyPatches(draft, patches) {
    for (let i = 0; i < patches.length; i++) {
        const patch = patches[i]
        if (patch.path.length === 0 && patch.op === "replace") {
            draft = patch.value
        } else {
            const path = patch.path.slice()
            const key = path.pop()
            const base = path.reduce((current, part) => {
                if (!current)
                    throw new Error(
                        "Cannot apply patch, path doesn't resolve: " +
                            patch.path.join("/")
                    )
                return current[part]
            }, draft)
            if (!base)
                throw new Error(
                    "Cannot apply patch, path doesn't resolve: " +
                        patch.path.join("/")
                )
            switch (patch.op) {
                case "replace":
                case "add":
                    // TODO: add support is not extensive, it does not support insertion or `-` atm!
                    base[key] = patch.value
                    break
                case "remove":
                    delete base[key]
                    break
                default:
                    throw new Error("Unsupported patch operation: " + patch.op)
            }
        }
    }
    return draft
}
