export default {
	testEnvironmentOptions: {
		url: "http://localhost"
	},
	globals: {
		__DEV__: true
	},
	// transform: {
	// 	"**/__tests__/**/*.tsx?": ['ts-jest', {
	// 		tsConfig: {
	// 			noUnusedLocals: false
	// 		},
	// 		disableSourceMapSupport: true
	// 	}]
	// },
	preset: "ts-jest/presets/js-with-ts-esm",
	testEnvironment: "node",
	testMatch: ["**/__tests__/**/*.[jt]s?(x)"]
}
