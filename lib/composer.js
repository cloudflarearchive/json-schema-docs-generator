'use strict';

var _ = require('lodash');
var colors = require('colors');
var Promise = require('bluebird');

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
};

/**
 * return {Promise}
 */
Composer.prototype.build = function() {
  return Promise.all([
    this.buildSchemas(),
    this.buildTemplates()
  ]).bind(this).then(_.spread(_.bind(this.compose, this)));
};

/**
 *
 * @param schemas
 * @param templates
 */
Composer.prototype.compose = function(schemas, templates) {
  // @TODO figure out how to compose pages
};

/**
 *
 * @param {Object} [options]
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
 *
 * @param {Object} schemas
 * @returns {Object}
 */
Composer.prototype.applyTransforms = function(schemas) {
  return _.reduce(this.transforms, function(schmas, Transformer) {
    var t = new Transformer(schmas, this.options);
    return t.transform(sch);
  }, schemas, this);
};

/**
 *
 * @param {Object} schemas
 * @returns {Promise}
 */
Composer.prototype.buildTemplates = function(schemas) {
  return this.templateDriver.fetch();
};

/**
 * @module lib/composer
 * @class Composer
 * @type {Function}
 */
modules.exports = Composer;
