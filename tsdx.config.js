module.exports = {
	// This function will run for each entry/format/env combination
	rollup(config, options) {
		return options.format === "esm"
			? {
					...config
			  }
			: config
	}
}
