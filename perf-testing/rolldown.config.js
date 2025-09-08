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
	resolve: {
		alias: {
			immer10Perf: "../dist/immer.mjs",
			immer: "../dist/immer.mjs"
		}
	}
}
