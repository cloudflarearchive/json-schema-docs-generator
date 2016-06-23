'use strict';

var resolver = require('./resolver');
var getFiles = require('./get-files');
var resolveGlobs = require('./helpers/resolve-globs');
var _ = require('lodash');
/**
 * @param {Array} globs
 * @params {Array} [exclusions]
 * @params {Object} [options]
 * @constructor
 */
var Parser = function (globs, exclusions, options) {
  this.globs = globs;
  this.exclusions = exclusions;
  this.options = options || {};
};

/**
 * Fetch file contents and resolve schemas.
 * Resolves the promise with an object, where the
 * keys are schema IDs and the values are the schema
 * contents.
 *
 * @returns {Promise}
 */
Parser.prototype.run = function() {
  return resolveGlobs(this.globs)
    .bind(this)
    .then(this.filterPaths)
    .then(this.retreive)
    .then(this.resolve)
};

/**
 * Remove undesired files by path
 *
 * @param {Array} paths
 * @returns {Array}
 */
Parser.prototype.filterPaths = function (paths) {
  return _.difference(paths, this.exclusions);
};

/**
 * Read and parse an array of files
 *
 * @param {Array} files
 * @return {Object}
 */
Parser.prototype.retreive = function(files) {
  return getFiles.asJSON(files);
};

/**
 * Resolve JSON schema references
 *
 * @param {Array} schemas
 * @returns {Array}
 */
Parser.prototype.resolve = function(schemas) {
  return resolver.resolve(_.values(schemas), {
    debugLevel: this.options.debugLevel
  });
};

/**
 * Key schemas by ID
 *
 * @param {Array} schemas
 * @return {Object}
 */
Parser.prototype.keySchemasById = function(schemas) {
  return _.transform(schemas, function(obj, schema) {
    obj[schema.id] = schema;
  }, {});
}

/**
 * Takes an array of filespaths/globs, fetches the contents
 * parses them, and resolves the JSON schema references
 *
 * @constructor
 * @module lib/parser
 * @class Parser
 * @type {Function}
 */
module.exports = Parser;
