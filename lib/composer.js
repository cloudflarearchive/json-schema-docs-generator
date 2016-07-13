'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var debug = require('./helpers/debug');
var save = require('./helpers/save-file');

/**
 * @param {SchemaDriver} schemaDriver
 * @param {TemplateDriver} templateDriver
 * @param {Object} [options]
 * @constructor
 */
var Composer = function(schemaDriver, templateDriver, options) {
  this.transforms = [];
  this.schemaDriver = schemaDriver;
  this.templateDriver = templateDriver;
  this.options = options || {};
  this.debugLevel = options.debugLevel || 0;

  if (!_.isArray(this.options.pages)) {
    throw new TypeError('No pages configured for the composer!');
  }
};

/**
 * Prepares schemas and templates, then call compose.
 *
 * @return {Promise}
 */
Composer.prototype.build = function() {
  return Promise.all([
    this.buildSchemas(),
    this.buildTemplates()
  ]).bind(this).then(_.spread(this.compose));
};

/**
 * Transforms page confguration into a fully stringified template
 *
 * @param {Object} schemas - keyed by ID
 * @param {Object} templates - keyed by file name
 * @return {Object}
 */
Composer.prototype.compose = function(schemas, templates) {
  return _.transform(this.options.pages, function(compiled, page) {
    if (!page.file) {
      throw new ReferenceError('You must specify a file for the page "' + page.title + '"');
    }
    compiled[page.file] = this.composePage(page, schemas, templates)
  }, {}, this);
};

/**
 * Build a page. Assumes a base template file
 *
 * @param {Object} page
 * @param {Object} schemas
 * @param {Object} templates
 * @returns {String}
 */
Composer.prototype.composePage = function(page, schemas, templates) {
  this._debug(2, 'Building page: %s', page.title);
  return templates.base(this.getPageTemplateData.apply(this, arguments));
};

/**
 * Build template data object
 *
 * @param {Object} page
 * @param {Object} schemas
 * @param {Object} templates
 * @returns {{page: {Object}, navigation: {currentPage: {Object}, allPages: {Array}}}
 */
Composer.prototype.getPageTemplateData = function(page, schemas, templates) {
  // Map schema IDs to the full schemas for data access in the templates
  _.each(page.sections, function(section) {
    section.schemas = _.map(section.schemas, function(schema) {
      return _.find(schemas, function(_schema) {
        return _schema.id === schema;
      });
    });
  });

  return {
    page: page,
    navigation: {
      currentPage: page,
      allPages: this.options.pages
    }
  };
};

/**
 * @param {Object} files
 * @returns {Promise}
 */
Composer.prototype.write = function(files) {
  return Promise.all(_.map(files, _.partial(save, this.options.destination || 'dist')));
}

/**
 * Reads and resolves schemas, then applies transformations
 *
 * @returns {Object}
 */
Composer.prototype.buildSchemas = function () {
  return this.schemaDriver.fetch()
    .bind(this)
    .then(this.applyTransforms);
};

/**
 * Add a transform class to be applied to the resolved schemas
 *
 * @param {Transformer} Transformer
 */
Composer.prototype.addTransform = function(Transformer) {
  this.transforms.push(Transformer);
};

/**
 * Runs the parsed schemas through transformers. Expects
 * the transformer to implement a `transform` method that returns
 * the modified schemas
 *
 * @param {Object} schemas
 * @returns {Object}
 */
Composer.prototype.applyTransforms = function(schemas) {
  return _.reduce(this.transforms, function(schmas, Transformer) {
    var t = new Transformer(schmas, this.options);
    return t.transform();
  }, schemas, this);
};

/**
 * Read and prepare the template files
 *
 * @param {Object} schemas
 * @returns {Promise}
 */
Composer.prototype.buildTemplates = function(schemas) {
  return this.templateDriver.fetch();
};

/**
 * @private
 */
Composer.prototype._debug = debug;

/**
 * @module lib/composer
 * @class Composer
 * @type {Function}
 */
module.exports = Composer;
