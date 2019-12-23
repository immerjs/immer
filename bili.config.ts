import {Config} from "bili"

const config: Config = {
	input: {
		immer: "src/index.ts"
	},
	output: {
		format: ["cjs", "umd", "esm"],
		moduleName: "immer",
		sourceMap: true,
		sourceMapExcludeSources: false
	},
	bundleNodeModules: true,
	babel: {
		// Replace babel-preset-env with buble
		minimal: true,
		babelrc: false
	},
	extendConfig(config, {format}) {
		if (format === "umd") {
			config.output.minify = true
		}
		if (format === "esm") {
			config.output.fileName = "[name].module.js"
		}
		return config
	}
}

export default config
