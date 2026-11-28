/**
 * Whether this is a production build.
 *
 * `process` is not defined when the bundled ESM build is loaded directly in a
 * browser, so reading `process.env.NODE_ENV` there throws a ReferenceError at
 * import time. Treat that case as non-production.
 */
export function detectProduction(): boolean {
	try {
		return process.env.NODE_ENV === "production"
	} catch {
		return false
	}
}

export const IS_PRODUCTION = /*#__PURE__*/ detectProduction()
