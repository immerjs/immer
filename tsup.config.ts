import {defineConfig, Options} from "tsup"
import fs from "fs"

export default defineConfig(options => {
	const commonOptions: Partial<Options> = {
		entry: {
			immer: "src/immer.ts"
		},
		sourcemap: true,
		...options
	}

	const productionOptions = {
		minify: true,
		esbuildOptions(options, _context) {
			options.mangleProps = /_$/
		},
		define: {
			"process.env.NODE_ENV": JSON.stringify("production")
		}
	}

	return [
		// ESM, standard bundler dev, embedded `process` references
		{
			...commonOptions,
			format: ["esm"],
			dts: true,
			clean: true,
			sourcemap: true,
			onSuccess() {
				// Support Flow types
				fs.copyFileSync("src/types/index.js.flow", "dist/cjs/index.js.flow")
			}
		},
		// ESM, Webpack 4 support. Target ES2018 syntax to compile away optional chaining and spreads
		{
			...commonOptions,
			entry: {
				"immer.legacy-esm": "src/immer.ts"
			},
			// ESBuild outputs `'.mjs'` by default for the 'esm' format. Force '.js'
			outExtension: () => ({js: ".js"}),
			target: "es2017",
			format: ["esm"],
			sourcemap: true
		},
		// ESM for use in browsers. Minified, with `process` compiled away
		{
			...commonOptions,
			...productionOptions,
			entry: {
				"immer.production": "src/immer.ts"
			},
			format: ["esm"],
			outExtension: () => ({js: ".mjs"})
		},
		// CJS development
		{
			...commonOptions,
			entry: {
				"immer.cjs.development": "src/immer.ts"
			},
			format: "cjs",

			outDir: "./dist/cjs/"
		},
		// CJS production
		{
			...commonOptions,
			...productionOptions,
			entry: {
				"immer.cjs.production": "src/immer.ts"
			},
			format: "cjs",
			outDir: "./dist/cjs/",
			onSuccess: () => {
				// Write the CJS index file
				fs.writeFileSync(
					"dist/cjs/index.js",
					`
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./immer.cjs.production.js')
} else {
  module.exports = require('./immer.cjs.development.js')
}`
				)
			}
		}
	]
})
