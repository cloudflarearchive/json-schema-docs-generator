'use strict';

var Parser = require('../lib/parser');

/**
 *
 * @param {Array} filePaths
 * @constructor
 */
var SchemaDriver = function(filePaths, exclusions, options) {
  this.filePaths = filePaths;
  this.exclusions = exclusions;
  this.options = options || {};
};

/**
 * Promise should resolve with an object of schemas, keyed by schema ID
 *
 * @returns {Promise}
 */
SchemaDriver.prototype.fetch = function() {
  var parser = new Parser(this.filePaths, this.exclusions, this.options);
  return parser.run();
};

/**
 * @class SchemaDriver
 * @module drivers/schema
 * @type {Function}
 */
module.exports = SchemaDriver;
