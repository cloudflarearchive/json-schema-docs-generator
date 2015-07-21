// @TODO Implement much of the schema manipulation in index.js here
'use strict';

var _ = require('lodash');
var path = require('path');
var pointer = require('./parser');
var Resolver = require('./resolver');
var curl = require('./helpers/curl');
var JSONformatter = require('./formatters/json');
var exampleExtractor = require('./example-data-extractor');
var ObjectDefinition = require('./object-definition');

/**
 *
 * @param {Array} schemas
 * @param {Object} [options]
 * @constructor
 */
var Transformer = function(schemas, options) {
  options = options || {};

  this.formatter = options.formatter || JSONformatter;
  this.schemas = schemas;
  // Used for looking up references within URIs
  // (and maybe other things at some point?)
  this._resolver = new Resolver(schemas, options);
}

/**
 * Perform the transform on the 'raw' resolved schemas
 *
 * @param {Array} schemas - fully resolved schemas
 * @param {SchemaDriver} driver - schema driver
 * @returns {Array}
 */
Transformer.prototype.transform = function(schemas, driver) {
  return _.map(schemas, this.transformSchema, this);
};

/**
 * Extend a schema with composed data for rendering in a template
 *
 * @param {Object} schema
 * @param {SchemaDriver} driver - used to resolve
 * @return {Object}
 */
Transformer.prototype.transformSchema = function(schema, driver) {
  return _.extend(schema, {
    // HTML-ready identifier
    htmlID: this._sanitizeHTMLID(schema.title),
    // Links are the available HTTP endpoints to interact with the object(s)
    links: this.transformLinks(schema, schema.links || []),
    // Object definition. Provides name, type, description, example, etc. for the schema.
    objectDefinition: this.generateObjectDefinition(schema)
  });
};

/**
 * Prepare a string to serve as an HTML id attribute
 *
 * @param {String} str
 * @return {String}
 */
Transformer.prototype._sanitizeHTMLID = function(str) {
  return str.toString().toLowerCase().replace(/[# ]+/gi, '-');
};

/**
 * @param {Object} schema
 * @param {Array} links
 * @return {Array}
 */
Transformer.prototype.transformLinks = function(schema, links) {
  return _.map(links, _.bind(this.transformLink, this, schema));
};

/**
 * Add additional metadata to the link object for API documentation
 *
 * @param {Object} schema
 * @param {Array} link
 */
Transformer.prototype.transformLink = function(schema, link) {
  return _.extend(link, {
    htmlID: this._sanitizeHTMLID(schema.title + '-' + link.title),
    uri: this.buildHref(link.href, schema),
    curl: this.buildCurl(link, schema),
    parameters: link.schema ? this.formatLinkParameters(link.schema) : undefined,
    response: link.targetSchema ? this.formatData(this.generateExample(link.targetSchema, schema)) : undefined
  });
};

/**
 * Note: Only supports resolving references relative to the given schema
 *
 * @param {String} href
 * @param {Object} schema
 * @param {Boolean} [withExampleData=false]
 * @return {String}
 */
Transformer.prototype.buildHref = function(href, schema, withExampleData) {
  // This will pull out all {/schema/pointers}
  var pattern = /((?:{(?:#?(\/[\w\/]+))})+)+/g;
  var matches = href.match(pattern);

  return _.reduce(matches, function (str, match) {
    // Remove the brackets so we can find the definition
    var stripped = match.replace(/[{}]/g, '');
    // Resolve the reference within the schema
    var definition = this._resolver.get(schema.id + stripped);
    // Replace the match with either example data or the last component of the pointer
    var replacement = withExampleData ? exampleExtractor.getExampleDataFromItem(definition) : ':' + path.basename(stripped);
    // /my/{#/pointer} -> /my/example_value OR /my/:pointer
    return str.replace(match, replacement);
  }, href, this);
};

/**
 * Generates a cURL string containing example data for
 * a link of a given schema.
 *
 * @param {Object} link
 * @param {String} link.href
 * @param {String} link.method
 * @param {Object} schema
 * @returns {String}
 */
Transformer.prototype.buildCurl = function (link, schema) {
  var uri = this.buildHref(link.href, schema, true);
  var headers = link.requestHeaders || _.get(this, 'options.curl.requestHeaders');
  var data = link.schemaExampleData;

  if (link.schema) {
    data = this.generateExample(link.schema, schema);
  }
  // @TODO: Make this better
  curl.formatter = this.formatter;
  return curl.generate(uri, link.method, headers, data);
};

/**
 * @param {*} data
 * @return {String}
 */
Transformer.prototype.formatData = function(data) {
  return this.formatter.format(data);
}

/**
 * Recursively build an object from a given schema component that is an example
 * representation of the object defined by the schema.
 *
 * @param {Object} component - valid subschema of the root/parent
 * @param {Object} root - parent schema used as the base
 * @param {Object} [options] - options for generating example representations of a schema
 * @returns {Object}
 */
Transformer.prototype.generateExample = function(component, root, options) {
  return exampleExtractor.extract(component, root, options);
};

/**
 * Loop over each properties in the inputs, assigning to either
 * a required or optional list.
 *
 * @param {Object} schema - Link inputs
 * @returns {ObjectDefinition}
 */
Transformer.prototype.formatLinkParameters = function(schema) {
  return new ObjectDefinition(schema, {
    formatter: this.formatter
  });

};

/**
 *
 * @param schema
 * @returns {ObjectDefinition}
 */
Transformer.prototype.generateObjectDefinition = function(schema) {
  return new ObjectDefinition(schema, {
    formatter: this.formatter
  });
};

/**
 * @module lib/transformer
 * @class Transformer
 * @type {Function}
 */
module.exports = Transformer;
