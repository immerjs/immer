module.exports = {
	testEnvironmentOptions: {
		url: "http://localhost"
	},
	preset: "ts-jest/presets/js-with-ts",
	testEnvironment: "node",
	testMatch: ["**/__tests__/**/*.[jt]s?(x)"]
}
