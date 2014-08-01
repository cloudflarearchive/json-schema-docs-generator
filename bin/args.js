// Command line options for the generator
'use strict';
var minimist = require('minimist');

// -v, --verbose = verbose
module.exports = function (args) {
	var parsed = minimist(args);

	return {
		verbose : parsed.verbose,
		debug : parsed.d || parsed.debug,
		silent : parsed.s || parsed.silent
	}
}
