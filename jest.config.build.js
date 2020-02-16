module.exports = {
	moduleNameMapper: {
		"src/.*": "<rootDir>"
	},
	testURL: "http://localhost",
	globals: {
		USES_BUILD: true,
		"ts-jest": {
			tsConfig: {
				noUnusedLocals: false
			}
		}
	},
	preset: "ts-jest/presets/js-with-ts",
	testEnvironment: "node",
	testMatch: ["**/__tests__/**/*.[jt]s?(x)"]
}
