import {readFileSync} from "node:fs"
import {fileURLToPath} from "node:url"

// enableArrayMethods() registers a plugin globally for a module instance and
// can't be undone. To benchmark the same build with and without it in one
// process, these aliases load a second, independent copy of the module.
const separateInstances = {
	immer10PerfAM: "../dist/immer.mjs",
	immer11AM: "./node_modules/immer11/dist/immer.mjs"
}

const separateInstancePrefix = "\0separate-instance:"

const separateInstancePlugin = {
	name: "separate-instance",
	resolveId(id) {
		if (id in separateInstances) return separateInstancePrefix + id
		return null
	},
	load(id) {
		if (!id.startsWith(separateInstancePrefix)) return null
		const name = id.slice(separateInstancePrefix.length)
		const file = fileURLToPath(
			new URL(separateInstances[name], import.meta.url)
		)
		return readFileSync(file, "utf8")
	}
}

export default {
	input: "immutability-benchmarks.mjs",
	output: {
		file: "dist/immutability-benchmarks.js",
		sourcemap: true
	},
	platform: "node",
	define: {
		"process.env.NODE_ENV": JSON.stringify("production")
	},
	external: ["bun:jsc", "@mitata/counters"],
	plugins: [separateInstancePlugin],
	resolve: {
		alias: {
			immer10Perf: "../dist/immer.mjs",
			immer: "../dist/immer.mjs"
		}
	}
}
