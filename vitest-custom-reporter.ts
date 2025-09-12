import {Reporter} from "vitest"

export default class CustomReporter implements Reporter {
	onFinished(files: any[], errors: unknown[]) {
		// Replicate the logic from ignoreObseleteSnapshots.js
		// Don't count obsolete snapshots as failures, just check if there are no failing tests
		const hasFailingTests = files.some(
			(file: any) =>
				file.result?.state === "fail" &&
				file.tasks?.some((task: any) => task.result?.state === "fail")
		)

		if (!hasFailingTests && errors.length === 0) {
			// Override success status similar to the original Jest processor
			process.exitCode = 0
		}
	}
}
