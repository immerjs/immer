import {defineConfig} from "vitest/config"

export default defineConfig({
	test: {
		environment: "node",
		include: ["**/__tests__/**/*.[jt]s?(x)"],
		globals: true,
		setupFiles: [],
		coverage: {
			provider: "v8", // default in Vitest 3
			reporter: ["text", "lcov"], // add "lcov" here
			reportsDirectory: "./coverage" // makes sure lcov.info lands here
		}
	}
})
