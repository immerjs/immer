import {defineConfig} from "vitest/config"
import path from "path"

export default defineConfig({
	resolve: {
		alias: {
			"^src/(.*)": path.resolve(__dirname, "dist/cjs/immer.cjs.production.js")
		}
	},
	define: {
		"global.USES_BUILD": true,
		"process.env.NODE_ENV": '"production"'
	},
	test: {
		environment: "node",
		include: ["**/__tests__/**/*.[jt]s?(x)"],
		globals: true,
		resolveSnapshotPath: (testPath: string, snapExtension: string) =>
			testPath.replace("__tests__", "__tests__/__prod_snapshots__") +
			snapExtension,
		reporters: ["default", "./vitest-custom-reporter.ts"]
	}
})
