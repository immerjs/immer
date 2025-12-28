import {defineConfig} from "vitest/config"
import path from "path"

const prodCJSPath = path.resolve(__dirname, "dist/cjs/immer.cjs.production.js")

export default defineConfig({
	resolve: {
		// 	// Make all `immer` imports use the production build
		alias: [
			{
				find: /^src\/(.*)/,
				replacement: prodCJSPath
			},
			{
				find: "../src/immer",
				replacement: prodCJSPath
			},
			{
				find: "immer",
				replacement: prodCJSPath
			}
		],
		// Ensure only one copy of immer is used throughout the dependency tree
		dedupe: ["immer"]
	},
	// Force Vite to process immer so our alias applies to dependencies too
	optimizeDeps: {
		include: ["immer"],
		// Force re-bundling to pick up our alias
		force: true
	},
	// SSR settings are needed because Vitest runs in Node environment
	ssr: {
		// Don't externalize immer - this makes our alias apply to it
		noExternal: ["immer"]
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
		reporters: ["default", "./vitest-custom-reporter.ts"],
		// Ensure deps are processed through Vite's transform pipeline
		deps: {
			optimizer: {
				// For SSR (Node) environment, include immer so it's transformed
				ssr: {
					include: ["immer"]
				}
			}
		}
	}
})
