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
        each(state.assigned, (key, added) => {
            const path = basepath.concat(key)
            patches.push(
                added
                    ? {
                          op: "replace",
                          path,
                          value: resultValue[key]
                      }
                    : {
                          op: "remove",
                          path
                      }
            )
            inversePatches.push(
                added && !key in baseValue
                    ? {op: "remove", path}
                    : {op: "replace", path, value: baseValue[key]}
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
