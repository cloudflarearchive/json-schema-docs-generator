/**
 * Schema resolver
 * Recursively resolves reference from an array of schemas
 *
 * @module lib/resolver
 */
'use strict';

var _ = require('lodash');
var pointer = require('./pointer');
var deep = require('deep-get-set');
var debug = require('./helpers/debug');
var chalk = require('chalk');
var Resolver;

var INTERNAL_SCHEMA_REFERENCE_SEPARATOR = '#';
var DEBUG_PREFIX = 'SCHEMA RESOLVER: ';
/**
 *
 * @constructor
 * @class Resolver
 * @param {Object} options
 * @param {Array} options.schemas - An array of schema objects to recurse through and resolve
 * @param {Number} [options.debugLevel] - runtime debug level
 */
Resolver = function(schemas, options) {
  options = options || {};
  // Our lookup reference for other schemas
  this.schemas = schemas;
  this.debugLevel = options.debugLevel || 0;

  if (!_.isArray(this.schemas)) {
    throw new ReferenceError('Schemas must be an array. Received: ' + (typeof this.schemas));
  }

  // Immediately key schemas by ID for supporting functions
  this.schemas = _.reduce(this.schemas, function(obj, schema) {
    obj[schema.id] = schema;
    return obj;
  }, {});
}

/**
 * Output a message to the console if the class was configured
 * to display messages within the threshold.
 *
 * @param {Number} level
 * @private
 */
Resolver.prototype._debug = debug;

/**
 * The heavy lifter. This is a recursive method that will traverse over each key in
 * the given `schema` and resolve the values until there are no $ref occurrences left.
 *
 * @param {Object} schema - a valid JSON schema object
 * @param {String} context - schema ID of the current resolving context
 * @param {String} [prop] - Used in a recursive context, specifically when a `$ref` is found and the result of the `$ref` needs to be assigned to the original property
 * @param {Object} [stack] - The parent object that contains the above `prop` when in the `$ref` context, so we can assign the result to the parent.
 * @returns {*}
 */
Resolver.prototype.dereferenceSchema = function (schema, context, prop, stack) {
  // If the value is not an object, we've reach the end of the line, so just return the value
  if (!_.isPlainObject(schema)) {
    return schema;
  }

  // Loop through the object and recursively resolve each value
  _.each(schema, function(item, property){
    var resolved;
    // Found a sub-schema
    if (property === '$ref') {
      this._debug(3, 'Found $ref: %s in %s - Resolving...', item, context);
      // Resolve schema or definition reference (throws if it can't find it)
      resolved = this._resolvePointer(item, context);
      // Assign the resolved reference as the schema for this prop/stack loop.
      // Pass along the resolved ID if it's a valid schema, to
      // force a context change when recursing
      schema = this.dereferenceSchema(resolved, this._normalizeReference(item, context), prop, stack);
      // Quit this loop once we've found a `$ref`
      return false;
    }

    // Standard object, recurse down through
    if (_.isPlainObject(item)) {
      this.dereferenceSchema(item, context, property, schema);
    }

    // This will occur in `allOf`, `oneOf`, `anyOf` contexts, where
    // there are an array of schemas
    if (_.isArray(item)) {
      this._debug(3, 'Found "%s" in %s with %d items - Resolving...', property, context, item.length);

      return item.forEach(function(s, idx){
        this.dereferenceSchema(s, context, idx, item);
      }, this);
    }
  }, this);

  // If we're resolving a property in a stack, assign the resulting schema
  // in the property location. This important when looping through nested
  // $refs and when iterating over arrays
  if (stack && !_.isUndefined(prop)) {
    this._debug(3, 'Assigning "%s" to resolved schema: %s', prop, schema.id || schema.title || 'No identifier');
    stack[prop] = schema;
  }

  return schema;
};

/**
 * Always return a full reference, including root schema ID
 * with any relative pointer appended
 *
 * @param {String} reference - reference to a property or schema
 * @param {String} [context] - current schema ID requesting reference
 * @returns {string}
 * @private
 */
Resolver.prototype._normalizeReference = function (reference, context) {
  // Split apart the references to get the external and internal references
  var referenceComponents = reference.split(INTERNAL_SCHEMA_REFERENCE_SEPARATOR);
  var contextComponents = _.isString(context) ? context.split(INTERNAL_SCHEMA_REFERENCE_SEPARATOR) : [];
  var schemaID = referenceComponents[0];
  var contextID = contextComponents[0] || '';
  // Undefined if the reference is relative
  var resolvedSchema = this.schemas[schemaID];
  var internalReference = '';

  if (_.isEmpty(schemaID) && referenceComponents[1]) {
    // If the reference contains an internal reference only,
    // fall back to the schema from where this reference came.
    resolvedSchema = this.schemas[contextID];
  }

  // Build the internal reference to prepend to the resolved schema ID
  if (referenceComponents[1]) {
    internalReference = '#' + referenceComponents[1];
  }

  if (!resolvedSchema) {
    throw new ReferenceError('Bad URI: ' + chalk.red(reference) + ' (in: ' + chalk.yellow(contextID) + ')');
  }

  return resolvedSchema.id + internalReference;
}

/**
 * Look up a reference based on a given URI. `context` will be used as the schema
 * if the URI is relative (i.e., starts with #)
 *
 * @param {String} uri - pointer reference to a schema or property
 * @param {String} [context] - The current schema ID that's requesting the reference (used when the context is relative, `#/definitions/example`)
 * @returns {*}
 * @throws ReferenceError
 * @private
 */
Resolver.prototype._resolvePointer = function(uri, context) {
  // Resolve the URI so a schema ID is always included
  // Implicitly this will also ensure the pointer is valid
  // or else it will throw.
  uri = this._normalizeReference(uri, context);

  var pieces = uri.split(INTERNAL_SCHEMA_REFERENCE_SEPARATOR);
  var schema = this.schemas[pieces[0]];
  var reference;

  if (pieces[1]) {
    // Go fetch the internal reference
    reference = pointer.get(schema, pieces[1]);
  } else {
    // If there is no deep reference, just return the whole schema
    reference = schema;
  }

  if (reference) {
    this._debug(2, 'Resolved reference: %s', chalk.green(uri));
  } else {
    throw new ReferenceError('Bad reference from '+ chalk.yellow(context) + ': ' + chalk.red(uri));
  }

  return reference;
};


/**
 * Traverse each schema and resolve all references.
 *
 * @return {Array}
 */
Resolver.prototype.resolve = function () {
  return _.map(this.schemas, this.dereferenceSchema, this);
};

/**
 * Get a property or schema by pointer reference
 *
 * @param {String} reference - pointer reference to a schema or property
 * @returns {Object}
 */
Resolver.prototype.get = function (reference) {
  return this._resolvePointer(reference);
}

/**
 * Add a schema to the list
 *
 * @param {Object} schema
 * @returns {Resolver}
 * @throws Error
 */
Resolver.prototype.addSchema = function (schema) {
  if (!_.isPlainObject(schema)) {
    throw new Error('Schema must be an object to add');
  }

  this.schemas[schema.id] = schema;
  return this;
}

/**
 * Remove a schema from the list
 *
 * @param {String|Object} schema
 * @returns {Resolver}
 */
Resolver.prototype.removeSchema = function (schema) {
  delete this.schemas[schema.id || schema];
  return this;
}

/**
 * @constructor
 * @class Resolver
 * @type {Function}
 */
module.exports = Resolver;
