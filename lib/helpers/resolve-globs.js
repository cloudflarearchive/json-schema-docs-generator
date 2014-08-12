// Resolve a set of globs
// ======================
'use strict';

var Promise = require('bluebird');
var glob = require('glob');

// Returns a promise, which when resolves will provide an array of expanded files
// from the globs.
//
// @param globs array - Array of globs to resolve.
// @return Promise
module.exports = function (globs, options) {
	return new Promise(function (resolve, reject) {
		var paths = [];
		var total = globs.length;

		globs.forEach(function (g, idx) {
			glob(g, options, function (err, files) {
				if (err) { reject(err); }
				// Merge in all the files
				paths = paths.concat(files);

				if ((idx+1) === total) {
					resolve(paths);
				}
			});
		});
	});
};
