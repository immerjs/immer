module.exports = {
	moduleNameMapper: {
		"src/.*": "<rootDir>/dist/immer.cjs.production.min.js"
	},
	testEnvironmentOptions: {
		url: "http://localhost"
	},
	globals: {
		USES_BUILD: true
	},
	preset: "ts-jest/presets/js-with-ts",
	testEnvironment: "node",
	testMatch: ["**/__tests__/**/*.[jt]s?(x)"],
	snapshotResolver: "<rootDir>/jest.config.build.snapshots.js",
	testResultsProcessor: "<rootDir>/ignoreObseleteSnapshots.js"
}
