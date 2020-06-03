module.exports = {
	testURL: "http://localhost",
	globals: {
		__DEV__: true,
		"ts-jest": {
			tsConfig: {
				noUnusedLocals: false
			},
			disableSourceMapSupport: true
		}
	},
	preset: "ts-jest/presets/js-with-ts",
	testEnvironment: "node",
	testMatch: ["**/__tests__/**/*.[jt]s?(x)"]
}
