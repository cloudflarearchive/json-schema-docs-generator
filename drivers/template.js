'use strict';

var getFiles = require('../lib/get-files');
var resolveGlobs = require('../lib/helpers/resolve-globs');
var Handlebars = require('handlebars');
var path = require('path');
var _ = require('lodash');
var chalk = require('chalk');
var DEBUG_PREFIX = 'TEMPLATE DRIVER: ';

/**
 *
 * @param {Array} filePaths
 * @param {Object} [options]
 * @param {Number} [options.debugLevel]
 * @constructor
 */
var TemplateDriver = function(filePaths, options) {
  options = options || {};
  this.filePaths = filePaths;
  this.options = options;
  this.debugLevel = options.debugLevel || 0;
};

/**
 * @return {Promise}
 */
TemplateDriver.prototype.fetch = function() {
  return resolveGlobs(this.filePaths)
    .bind(this)
    .then(this._retrieve)
    .then(this._transform)
    .then(this._compile);
};

/**
 *
 * @param {Array} files - array of file paths to get from disk
 * @returns {Promise}
 * @private
 */
TemplateDriver.prototype._retrieve = function(files) {
  return getFiles.raw(files);
};

/**
 * Order the templates by key length. This solves an issue
 * where you may want to include multiple template paths, and have
 * some templates override others. The assumption here is that
 * deeper-nested templates will prevail.
 *
 * @param {Object} files - Resolved files, keyed by filepath
 * @return {Object} - templates contents, keyed by filename
 * @private
 */
TemplateDriver.prototype._transform = function(templates) {
  // Map to an array so we can sort by filepath length
  templates = _(templates).map(function(contents, path) {
    return {
      path: path,
      contents: contents
    };
  // Sort by file path length
  }).sortBy(function(config) {
    return config.path.length;
  // Transform back to an object keyed by file name
  }).transform(function (obj, config) {
    var base = path.basename(config.path, path.extname(config.path));
    if (obj[base]) {
      this._debug(1, 'Overwriting %s with %s', chalk.yellow(base), chalk.grey(config.path));
    }
    obj[base] = config.contents;
  }, {}, this);

  return templates.value();
};

/**
 * @param {Object} templates - Object of templates, keyed by filename
 * @return {Object} - Object of compiled templates, keyed by filename
 * @private
 */
TemplateDriver.prototype._compile = function(templates) {
  templates = _.mapValues(templates, function(str) {
    return Handlebars.compile(str, {preventIndent: true});
  });
  // Register each template as a partial, so they can be included in each other
  _.each(templates, function(source, name) {
    Handlebars.registerPartial(name, source);
  });

  return templates;
};

/**
 * Output a message to the console if the class was configured
 * to display messages within the threshold.
 *
 * @param {Number} level
 * @private
 */
TemplateDriver.prototype._debug = function(level) {
  var args = _.rest(arguments);
  var debugLevel = this.debugLevel;
  //var args = [].slice.call(arguments, 1);
  if (debugLevel && level <= debugLevel ) {
    args[0] = DEBUG_PREFIX + args[0];
    global.console.log.apply(global.console.log, args);
  }
};

/**
 * @constructor
 * @class TemplateDriver
 * @module drivers/template
 * @type {Function}
 */
module.exports = TemplateDriver;
