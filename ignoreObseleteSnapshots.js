module.exports = function(results) {
	// don't count obselete snapshot as a failure, but just check if there are no failing tests
	// console.dir(results)
	results.success = results.testResults.every(r => r.numFailingTests === 0)
	return results
}
