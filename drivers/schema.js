'use strict';

var Parser = require('../lib/parser');

/**
 *
 * @param {Array} filePaths
 * @constructor
 */
var SchemaDriver = function(filePaths, exclusions, options) {
  this.filePaths = filePaths;
  this.parser = new Parser(filePaths, exclusions, options);
};

/**
 * Promise should resolve with an object of schemas, keyed by schema ID
 *
 * @returns {Promise}
 */
SchemaDriver.prototype.fetch = function() {
  return this.parser.run();
};

/**
 * @class SchemaDriver
 * @module drivers/schema
 * @type {Function}
 */
module.exports = SchemaDriver;
