module.exports = {
	// This function will run for each entry/format/env combination
	rollup(config, options) {
		return options.format === "esm"
			? {
					...config,
					// this makes sure sideEffects: true can clean up files
					preserveModules: true,
					output: {
						dir: "dist"
					}
			  }
			: config
	}
}
