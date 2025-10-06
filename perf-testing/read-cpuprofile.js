import fs from "fs"
import {SourceMapConsumer} from "source-map"

let profileName = process.argv[2]

if (!profileName) {
	const cpuProfiles = fs.readdirSync(".").filter(f => f.endsWith(".cpuprofile"))
	const [lastProfile] = cpuProfiles.slice(-1)
	if (!lastProfile) {
		console.error("Usage: node read-cpuprofile.js <path-to-cpuprofile>")
		process.exit(1)
	}
	console.log("Using latest profile: ", lastProfile)
	profileName = lastProfile
}

const profile = JSON.parse(fs.readFileSync(profileName, "utf8"))

// Load multiple sourcemaps for better function name resolution
const sourceMapConsumers = new Map()

// Load main bundled sourcemap
try {
	const mainSourceMapPath = "dist/immutability-benchmarks.js.map"
	if (fs.existsSync(mainSourceMapPath)) {
		const sourceMapContent = fs.readFileSync(mainSourceMapPath, "utf8")
		const consumer = await SourceMapConsumer.with(
			sourceMapContent,
			null,
			consumer => consumer
		)
		sourceMapConsumers.set("main", consumer)
	}
} catch (error) {
	console.warn("Could not load main sourcemap:", error.message)
}

const cjsMinMap = "immer.cjs.production.min.js.map"
const cjsProdMap = "cjs/immer.cjs.production.js.map"

const immerVersionMaps = {
	5: cjsMinMap,
	6: cjsMinMap,
	7: cjsMinMap,
	8: cjsMinMap,
	9: cjsMinMap,
	10: cjsProdMap,
	"10Perf": cjsProdMap
}

// Load individual Immer version sourcemaps
for (const [version, mapName] of Object.entries(immerVersionMaps)) {
	try {
		const immerParentPath =
			version === "10Perf" ? ".." : `./node_modules/immer${version}`
		const sourcemapPath = `${immerParentPath}/dist/${mapName}`
		if (fs.existsSync(sourcemapPath)) {
			const sourceMapContent = fs.readFileSync(sourcemapPath, "utf8")
			const consumer = await SourceMapConsumer.with(
				sourceMapContent,
				null,
				consumer => consumer
			)
			sourceMapConsumers.set(`v${version}`, consumer)
			console.log(`Loaded sourcemap for Immer v${version}`)
		}
	} catch (error) {
		console.warn(
			`Could not load sourcemap for Immer v${version}:`,
			error.message
		)
	}
}

console.log(`Loaded ${sourceMapConsumers.size} sourcemaps total\n`)

// Function to extract Immer version from source path
function extractImmerVersion(sourcePath) {
	if (!sourcePath) return "unknown"

	// Match patterns like: immer@7.0.15, immer@8.0.1, etc.
	const versionMatch = sourcePath.match(/immer@(\d+(?:\.\d+)*)/)
	if (versionMatch) return `v${versionMatch[1]}`

	// Match patterns like: immer5, immer6, immer7, etc.
	const simpleVersionMatch = sourcePath.match(/immer(\d+(?:Perf)?)/)
	if (simpleVersionMatch) return `v${simpleVersionMatch[1]}`

	// Check for local builds
	if (sourcePath.includes("../../dist")) return "v10Perf"

	return "unknown"
}

// Function to categorize function types for better analysis
function categorizeFunctionType(functionName, sourcePath, location) {
	const lowerName = functionName.toLowerCase()
	const lowerSource = (sourcePath || "").toLowerCase()

	// Node.js internal functions
	const nodeInternals = [
		"requirebuiltin",
		"compileforiternalloader",
		"writegeneric",
		"writestream",
		"getheapstatistics",
		"open",
		"read",
		"write",
		"stat",
		"close",
		"readdir",
		"createreadstream",
		"createwritestream",
		"emitwarning",
		"process",
		"nextick",
		"setimmediate",
		"settimeout",
		"clearimmediate",
		"cleartimeout"
	]

	if (nodeInternals.some(internal => lowerName.includes(internal))) {
		return "node-internal"
	}

	// V8 engine functions
	const v8Functions = [
		"get",
		"set",
		"value",
		"call",
		"apply",
		"bind",
		"construct",
		"defineProperty",
		"getownpropertydescriptor",
		"hasownproperty"
	]

	if (v8Functions.some(v8fn => lowerName === v8fn) && location === "unknown") {
		return "v8-internal"
	}

	// Benchmark/test code
	const benchmarkFunctions = [
		"benchmethod",
		"main",
		"immerreducer",
		"vanillareducer",
		"createimmerreducer",
		"createbenchmarks",
		"run",
		"bench",
		"group",
		"summary"
	]

	if (benchmarkFunctions.some(bench => lowerName.includes(bench))) {
		return "benchmark"
	}

	// Third-party libraries (from node_modules)
	if (
		lowerSource.includes("node_modules") ||
		sourcePath?.includes("node_modules")
	) {
		return "third-party"
	}

	// Immer functions
	if (
		lowerName.includes("immer") ||
		lowerName.includes("produce") ||
		lowerName.includes("preparecopy") ||
		lowerName.includes("finalize") ||
		lowerName.includes("isdraft") ||
		lowerName.includes("current") ||
		lowerName.includes("proxy")
	) {
		return "immer"
	}

	// Anonymous functions in known files
	if (
		functionName === "(anonymous)" &&
		(location.includes("main.mjs") || location.includes("lib.mjs"))
	) {
		return "benchmark"
	}

	return "application"
}

// Enhanced minified function name mapping based on common patterns
const minifiedFunctionPatterns = {
	// Common Immer function patterns across versions
	n$1: "prepareCopy",
	e$1: "finalize",
	M$2: "finalizeProperty",
	t$1: "isDraft",
	r$1: "current",
	o$1: "isPlainObject",
	i$1: "shallowCopy",
	a$1: "each",
	u$1: "readPropFromProto",
	s$1: "createProxy",
	c$1: "createProxyProxy",
	l$1: "markChanged",
	f$1: "freeze",
	d$1: "die"
}

// TODO Not sure if this actually helps
function enhanceMinifiedName(functionName, version) {
	// Try direct pattern matching first
	if (minifiedFunctionPatterns[functionName]) {
		return minifiedFunctionPatterns[functionName]
	}

	// Try pattern matching with version-specific adjustments
	const basePattern = functionName.replace(/\$\d+$/, "")
	for (const [pattern, realName] of Object.entries(minifiedFunctionPatterns)) {
		if (pattern.startsWith(basePattern)) {
			return realName
		}
	}

	return functionName
}

// Function to resolve minified function names using appropriate sourcemap
function resolveOriginalName(callFrame) {
	if (!callFrame.url || !callFrame.url.includes("immutability-benchmarks.js")) {
		return {
			name: callFrame.functionName || "(anonymous)",
			version: "unknown",
			location: "unknown"
		}
	}

	// First try main sourcemap
	const mainConsumer = sourceMapConsumers.get("main")
	if (mainConsumer) {
		try {
			const originalPosition = mainConsumer.originalPositionFor({
				line: callFrame.lineNumber + 1, // V8 uses 0-based, sourcemap uses 1-based
				column: callFrame.columnNumber
			})

			if (originalPosition.source) {
				const sourceFile = originalPosition.source.split("/").pop() || "unknown"
				let version = extractImmerVersion(originalPosition.source)
				let functionName =
					originalPosition.name || callFrame.functionName || "(anonymous)"
				const location = `${sourceFile}:${originalPosition.line}`

				// Enhanced version detection for better accuracy
				if (version === "unknown") {
					// Check for node_modules path pattern like ../node_modules/mitata/src/lib.mjs
					const nodeModulesMatch = originalPosition.source.match(
						/node_modules\/([^\/]+)/
					)
					if (nodeModulesMatch) {
						version = nodeModulesMatch[1] // Extract library name like "mitata"
					} else {
						version = categorizeFunctionType(
							functionName,
							originalPosition.source,
							location
						)
					}
				}

				// If we detected a specific Immer version, try to get better resolution from that version's sourcemap
				if (version !== "unknown") {
					const versionConsumer = sourceMapConsumers.get(version)
					if (versionConsumer) {
						try {
							// For minified functions, try to resolve using the version-specific sourcemap
							if (
								functionName.length <= 3 ||
								/^[a-zA-Z]\$?\d*$/.test(functionName)
							) {
								const versionPosition = versionConsumer.originalPositionFor({
									line: 1, // Most minified files are single line
									column: callFrame.columnNumber
								})

								if (
									versionPosition.name &&
									versionPosition.name !== functionName
								) {
									return {
										name: versionPosition.name,
										version: version,
										location: `${versionPosition.source?.split("/").pop() ||
											sourceFile}:${versionPosition.line}`
									}
								}
							}
						} catch (error) {
							// Continue with main sourcemap result
						}
					}
				}

				return {
					name: functionName,
					version: version,
					location: location
				}
			}
		} catch (error) {
			// Fallback to original name if sourcemap resolution fails
		}
	}

	return {
		name: callFrame.functionName || "(anonymous)",
		version: "unknown",
		location: "unknown"
	}
}

// Extract function call statistics
const functionStats = new Map()
const versionStats = new Map() // Track stats by Immer version
const categoryStats = new Map() // Track stats by function category
const samples = profile.samples || []
const timeDeltas = profile.timeDeltas || []

// Process samples to count function calls
samples.forEach((nodeId, index) => {
	const node = profile.nodes[nodeId]
	if (node && node.callFrame) {
		const resolved = resolveOriginalName(node.callFrame)
		const fileName = node.callFrame.url || ""
		const sampleCount = timeDeltas[index] || 1

		// Categorize the function
		const category = categorizeFunctionType(
			resolved.name,
			resolved.source || fileName,
			resolved.location
		)

		// Create key with version info
		const key = `${resolved.name} [${resolved.version}] (${resolved.location})`
		functionStats.set(key, (functionStats.get(key) || 0) + sampleCount)

		// Track by version
		if (!versionStats.has(resolved.version)) {
			versionStats.set(resolved.version, new Map())
		}
		const versionMap = versionStats.get(resolved.version)
		const versionKey = `${resolved.name} (${resolved.location})`
		versionMap.set(versionKey, (versionMap.get(versionKey) || 0) + sampleCount)

		// Track by category
		if (!categoryStats.has(category)) {
			categoryStats.set(category, new Map())
		}
		const categoryMap = categoryStats.get(category)
		const categoryKey = `${resolved.name} [${resolved.version}] (${resolved.location})`
		categoryMap.set(
			categoryKey,
			(categoryMap.get(categoryKey) || 0) + sampleCount
		)
	}
})

// Show breakdown by Immer version
console.log("\n\nBreakdown by Immer Version:")
console.log("===========================")
const sortedVersions = Array.from(versionStats.entries())
	.map(([version, funcMap]) => {
		const totalSamples = Array.from(funcMap.values()).reduce(
			(sum, count) => sum + count,
			0
		)
		return {version, totalSamples, functions: funcMap}
	})
	.sort((a, b) => b.totalSamples - a.totalSamples)

// don't log "mitata" or "node"
sortedVersions
	.filter(sv => sv.version.startsWith("v"))
	.forEach(({version, totalSamples, functions}) => {
		if (totalSamples < 25000) return // Skip low-impact versions
		console.log(`\n${version}: ${totalSamples} total samples`)
		const topFunctions = Array.from(functions.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 20)

		topFunctions.forEach(([func, samples], index) => {
			console.log(`  ${index + 1}. ${func}: ${samples} samples`)
		})
	})

// Performance comparison between versions for key functions
console.log("\n\nPerformance Comparison - Key Functions by Version:")
console.log("==================================================")
const keyFunctions = [
	"prepareCopy",
	"finalize",
	"finalizeProperty",
	"each",
	"isPlainObject"
]

keyFunctions.forEach(funcName => {
	console.log(`\n${funcName}:`)
	const versionComparison = []

	versionStats.forEach((functions, version) => {
		let totalSamples = 0
		functions.forEach((samples, func) => {
			if (func.toLowerCase().includes(funcName.toLowerCase())) {
				totalSamples += samples
			}
		})
		if (totalSamples > 0) {
			versionComparison.push({version, samples: totalSamples})
		}
	})

	versionComparison
		.sort((a, b) => b.samples - a.samples)
		.forEach(({version, samples}) => {
			console.log(`  ${version}: ${samples} samples`)
		})
})

// // Analysis by function category
// console.log("\n\nBreakdown by Function Category:")
// console.log("===============================")
// const sortedCategories = Array.from(categoryStats.entries())
// 	.map(([category, funcMap]) => {
// 		const totalSamples = Array.from(funcMap.values()).reduce(
// 			(sum, count) => sum + count,
// 			0
// 		)
// 		return {category, totalSamples, functions: funcMap}
// 	})
// 	.sort((a, b) => b.totalSamples - a.totalSamples)

// const totalSamples = Array.from(functionStats.values()).reduce(
// 	(sum, samples) => sum + samples,
// 	0
// )

// sortedCategories.forEach(({category, totalSamples: catSamples, functions}) => {
// 	const percentage = ((catSamples / totalSamples) * 100).toFixed(1)
// 	console.log(`\n${category}: ${catSamples} samples (${percentage}%)`)

// 	// Show top functions in this category
// 	const topFunctions = Array.from(functions.entries())
// 		.sort((a, b) => b[1] - a[1])
// 		.slice(0, 10)

// 	topFunctions.forEach(([func, samples], index) => {
// 		const funcPercentage = ((samples / catSamples) * 100).toFixed(1)
// 		console.log(
// 			`  ${index +
// 				1}. ${func}: ${samples} samples (${funcPercentage}% of category)`
// 		)
// 	})
// })

// // Analysis of truly uncategorized functions
// console.log("\n\nAnalysis of uncategorized functions:")
// console.log("====================================")

// // Get functions that are still in the 'application' category with unknown version
// // These are the ones that need better categorization
// const uncategorizedStats = []
// categoryStats.get("application")?.forEach((samples, funcKey) => {
// 	if (funcKey.includes("[unknown]")) {
// 		uncategorizedStats.push([funcKey, samples])
// 	}
// })

// // Also check for any functions that might have been missed entirely
// const versionUnknownStats = Array.from(functionStats.entries()).filter(
// 	([func]) => {
// 		// Only include functions that are both version unknown AND not properly categorized
// 		if (!func.includes("[unknown]")) return false

// 		// Check if this function was categorized as something other than 'application'
// 		const funcName = func.split(" [")[0]
// 		const category = categorizeFunctionType(funcName, "", "unknown")
// 		return category === "application"
// 	}
// )

// // Combine and deduplicate
// const allUncategorized = new Map()
// uncategorizedStats.forEach(([func, samples]) => {
// 	allUncategorized.set(func, samples)
// })
// versionUnknownStats.forEach(([func, samples]) => {
// 	if (!allUncategorized.has(func)) {
// 		allUncategorized.set(func, samples)
// 	}
// })

// const sortedUncategorized = Array.from(allUncategorized.entries())
// 	.sort((a, b) => b[1] - a[1])
// 	.slice(0, 15)

// if (sortedUncategorized.length > 0) {
// 	console.log(
// 		"Top uncategorized functions (may need better categorization logic):"
// 	)
// 	sortedUncategorized.forEach(([func, samples], index) => {
// 		console.log(`  ${index + 1}. ${func}: ${samples} samples`)
// 	})

// 	const totalUncategorizedSamples = sortedUncategorized.reduce(
// 		(sum, [, samples]) => sum + samples,
// 		0
// 	)
// 	const totalSamples = Array.from(functionStats.values()).reduce(
// 		(sum, samples) => sum + samples,
// 		0
// 	)
// 	const uncategorizedPercentage = (
// 		(totalUncategorizedSamples / totalSamples) *
// 		100
// 	).toFixed(1)
// 	console.log(
// 		`\nTotal uncategorized samples: ${totalUncategorizedSamples} (${uncategorizedPercentage}% of total)`
// 	)
// } else {
// 	console.log("All functions are properly categorized!")
// }

// Summary statistics
console.log("\n\nSummary Statistics:")
console.log("===================")
const totalSamples = Array.from(functionStats.values()).reduce(
	(sum, samples) => sum + samples,
	0
)
console.log(`Total CPU samples analyzed: ${totalSamples}`)

const versionBreakdown = Array.from(versionStats.entries())
	.map(([version, funcMap]) => {
		const samples = Array.from(funcMap.values()).reduce(
			(sum, count) => sum + count,
			0
		)
		const percentage = ((samples / totalSamples) * 100).toFixed(1)
		return {version, samples, percentage}
	})
	.sort((a, b) => b.samples - a.samples)

console.log("\nVersion breakdown:")
versionBreakdown.forEach(({version, samples, percentage}) => {
	if (samples < 25000) return // Skip low-impact versions
	console.log(`  ${version}: ${samples} samples (${percentage}%)`)
})

// Clean up sourcemap consumers
sourceMapConsumers.forEach(consumer => {
	consumer.destroy()
})
