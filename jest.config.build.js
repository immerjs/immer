module.exports = {
	moduleNameMapper: {
		"src/.*": "<rootDir>/dist/immer.esm.js"
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
	testMatch: ["**/__tests__/**/*.[jt]s?(x)"],
	snapshotResolver: "<rootDir>/jest.config.build.snapshots.js"
}
