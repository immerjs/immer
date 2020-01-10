import {
	get,
	each,
	has,
	die,
	getArchtype,
	ImmerState,
	Patch,
	ProxyType,
	SetState,
	ES5ArrayState,
	ProxyArrayState,
	MapState,
	ES5ObjectState,
	ProxyObjectState,
	Archtype,
	isMap
} from "./internal"

export type PatchPath = (string | number)[]

export function generatePatches(
	state: ImmerState,
	basePath: PatchPath,
	patches: Patch[],
	inversePatches: Patch[]
): void {
	switch (state.type) {
		case ProxyType.ProxyObject:
		case ProxyType.ES5Object:
		case ProxyType.Map:
			return generatePatchesFromAssigned(
				state,
				basePath,
				patches,
				inversePatches
			)
		case ProxyType.ES5Array:
		case ProxyType.ProxyArray:
			return generateArrayPatches(state, basePath, patches, inversePatches)
		case ProxyType.Set:
			return generateSetPatches(
				(state as any) as SetState,
				basePath,
				patches,
				inversePatches
			)
	}
}

function generateArrayPatches(
	state: ES5ArrayState | ProxyArrayState,
	basePath: PatchPath,
	patches: Patch[],
	inversePatches: Patch[]
) {
	let {base, assigned, copy} = state
	/* istanbul ignore next */
	if (!copy) die()

	// Reduce complexity by ensuring `base` is never longer.
	if (copy.length < base.length) {
		// @ts-ignore
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

	const replaceCount = patches.length

	// Process added indices.
	for (let i = end + delta - 1; i >= end; --i) {
		const path = basePath.concat([i])
		patches[replaceCount + i - end] = {
			op: "add",
			path,
			value: copy[i]
		}
		inversePatches.push({
			op: "remove",
			path
		})
	}
}

// This is used for both Map objects and normal objects.
function generatePatchesFromAssigned(
	state: MapState | ES5ObjectState | ProxyObjectState,
	basePath: PatchPath,
	patches: Patch[],
	inversePatches: Patch[]
) {
	const {base, copy} = state
	each(state.assigned!, (key, assignedValue) => {
		const origValue = get(base, key)
		const value = get(copy!, key)
		const op = !assignedValue ? "remove" : has(base, key) ? "replace" : "add"
		if (origValue === value && op === "replace") return
		const path = basePath.concat(key as any)
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

function generateSetPatches(
	state: SetState,
	basePath: PatchPath,
	patches: Patch[],
	inversePatches: Patch[]
) {
	let {base, copy} = state

	let i = 0
	base.forEach(value => {
		if (!copy!.has(value)) {
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
	})
	i = 0
	copy!.forEach(value => {
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
	})
}

export function applyPatches<T>(draft: T, patches: Patch[]): T {
	patches.forEach(patch => {
		const {path, op} = patch

		/* istanbul ignore next */
		if (!path.length) die()

		let base: any = draft
		for (let i = 0; i < path.length - 1; i++) {
			base = get(base, path[i])
			if (!base || typeof base !== "object")
				throw new Error("Cannot apply patch, path doesn't resolve: " + path.join("/")) // prettier-ignore
		}

		const type = getArchtype(base)
		const value = deepClonePatchValue(patch.value) // used to clone patch to ensure original patch is not modified, see #411
		const key = path[path.length - 1]
		switch (op) {
			case "replace":
				switch (type) {
					case Archtype.Map:
						return base.set(key, value)
					/* istanbul ignore next */
					case Archtype.Set:
						throw new Error('Sets cannot have "replace" patches.')
					default:
						// if value is an object, then it's assigned by reference
						// in the following add or remove ops, the value field inside the patch will also be modifyed
						// so we use value from the cloned patch
						// @ts-ignore
						return (base[key] = value)
				}
			case "add":
				switch (type) {
					case Archtype.Array:
						return base.splice(key as any, 0, value)
					case Archtype.Map:
						return base.set(key, value)
					case Archtype.Set:
						return base.add(value)
					default:
						return (base[key] = value)
				}
			case "remove":
				switch (type) {
					case Archtype.Array:
						return base.splice(key as any, 1)
					case Archtype.Map:
						return base.delete(key)
					case Archtype.Set:
						return base.delete(patch.value)
					default:
						return delete base[key]
				}
			default:
				throw new Error("Unsupported patch operation: " + op)
		}
	})

	return draft
}

// TODO: optimize: this is quite a performance hit, can we detect intelligently when it is needed?
// E.g. auto-draft when new objects from outside are assigned and modified?
// (See failing test when deepClone just returns obj)
function deepClonePatchValue<T>(obj: T): T
function deepClonePatchValue(obj: any) {
	if (!obj || typeof obj !== "object") return obj
	if (Array.isArray(obj)) return obj.map(deepClonePatchValue)
	if (isMap(obj))
		return new Map(
			Array.from(obj.entries()).map(([k, v]) => [k, deepClonePatchValue(v)])
		)
	// Not needed: if (isSet(obj)) return new Set(Array.from(obj.values()).map(deepClone))
	const cloned = Object.create(Object.getPrototypeOf(obj))
	for (const key in obj) cloned[key] = deepClonePatchValue(obj[key])
	return cloned
}
