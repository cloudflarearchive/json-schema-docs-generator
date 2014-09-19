// Resolve a set of globs
// ======================
'use strict';

var Promise = require('bluebird');
var glob = require('glob');
var _ = require('lodash');

// Returns a promise, which when resolves will provide an array of expanded files
// from the globs.
//
// @param globs array - Array of globs to resolve.
// @return Promise
module.exports = function (globs, options) {
	return new Promise(function (resolve, reject) {
		var total = globs.length;
		var promises = [];

		globs.forEach(function (g) {
			promises.push(new Promise(function(res, rej){
				glob(g, options, function (err, files) {
					if (err) { rej(err); }
					res(files);
				});
			}));
		});

		Promise.all(promises).then(function(files){
			resolve(_.flatten(files));
		}, reject);
	});
};
