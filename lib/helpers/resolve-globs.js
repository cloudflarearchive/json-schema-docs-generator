'use strict';

var Promise = require('bluebird');
var glob = Promise.promisify(require('glob'));
var _ = require('lodash');

/**
 * Returns a promise, which when resolves will provide an array of expanded files
 * from the globs.
 *
 * @param {Array} globs
 * @param {Object} [options]
 * @returns {Promise}
 * @function
 * @module lib/resolve-globs
 */
module.exports = function (globs, options) {
  return Promise.map(globs, function(pattern) {
    return glob(pattern, options);
  }).then(function (results) {
    return _.flatten(results);
  });
};
