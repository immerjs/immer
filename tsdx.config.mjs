import terser from "rollup-plugin-terser"

export default {
	// This function will run for each entry/format/env combination
	rollup(config, options) {
		if (options.format === "esm" || options.env === "production") {
			config.plugins.push(
				terser({
					sourcemap: true,
					module: true,
					compress: {
						hoist_funs: true,
						passes: 2,
						keep_fargs: false,
						pure_getters: true,
						unsafe: true
					},
					mangle: {
						properties: {
							regex: /_$/
						}
					}
				})
			)
		}
		return config
	}
}
