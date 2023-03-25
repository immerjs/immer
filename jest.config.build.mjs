export default {
	moduleNameMapper: {
		"src/.*": "<rootDir>/dist/immer.esm.js"
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
	snapshotResolver: "<rootDir>/jest.config.build.snapshots.cjs",
	testResultsProcessor: "<rootDir>/ignoreObseleteSnapshots.mjs"
}
