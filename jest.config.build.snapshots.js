module.exports = {
	// resolves from test to snapshot path
	resolveSnapshotPath: (testPath, snapshotExtension) =>
		testPath.replace("__tests__", "__tests__/__prod_snapshots__") +
		snapshotExtension,

	// resolves from snapshot to test path
	resolveTestPath: (snapshotFilePath, snapshotExtension) =>
		snapshotFilePath
			.replace("__tests__/__prod_snapshots__", "__tests__")
			.slice(0, -snapshotExtension.length),

	// Example test path, used for preflight consistency check of the implementation above
	testPathForConsistencyCheck: "some/__tests__/example.test.js"
}
