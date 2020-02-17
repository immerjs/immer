const {terser} = require("rollup-plugin-terser")

module.exports = {
	// This function will run for each entry/format/env combination
	rollup(config, options) {
		if (options.format === "esm") {
			config.plugins.push(
				terser({
					sourcemap: true,
					module: true,
					compress: {
						hoist_funs: true,
						passes: 3
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
