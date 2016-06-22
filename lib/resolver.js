/**
 * Schema resolver
 * Recursively resolves reference from an array or object of schemas
 *
 * @module lib/resolver
 */
'use strict';

var _ = require('lodash');
var colors = require('colors');
var flattenator = require('flattenator');
var pointer = require('./pointer');

var REFERENCE_SEPARATOR = '#';
var RECURSION_LEVELS = 0;
var DEBUG_PREFIX = 'SCHEMA RESOLVER: ';

/**
 * The only (main) function that should be used publicly
 *
 * @param {Object|Array} schemas - all schemas to resolve
 * @returns {Object} - resolved schemas
 */
var resolve = function(schemas, options) {
  options = options || {};
  var debugLevel = options.debugLevel || 0;

  // transform schemas into keyd object if we got an array
  if (_.isArray(schemas)) {
    schemas = _.reduce(schemas, function(obj, schema) {
      obj[schema.id] = schema;
      return obj;
    }, {});
  }

  // dereferenceSchemas
  var result = dereferenceSchemas(schemas, debugLevel);

  // remove (flat) $ref props
  var finalResult = {};
  _.forEach(flattenator.flatten('$.$', '$[$', '$]$')(result), function(value, prop) {
    finalResult[prop.replace(/\$\.\$\$ref/g, '')] = value;
  });

  return flattenator.nest('$.$', '$[$', '$]$')(finalResult);
};

/**
 *
 * @param {Object} schemas
 * @param {Number} debugLevel
 * @returns {Object}
 */
var dereferenceSchemas = function(schemas, debugLevel) {
  return _.mapValues(schemas, function(schema) {
    return dereferenceSchema(schema.id, '#', schemas, {}, debugLevel);
  });
};

/**
 * The heavy lifter. This is a recursive function that will traverse over each key in
 * the given schemas (schemas) and builds a new schema, where all $refs are
 * resolved.
 *
 * @param {String} schemaId - top level schema ID, context for internal resolutions
 * @param {String} path - JSON pointer of the schemas node that we are dereferencing
 * @param {Object} schemas - schemas, our "recipe" for building new schemas
 * @param {Number} debugLevel
 * @returns {Object} - resolved schema, without $refs
 */
var dereferenceSchema = function(schemaId, path, schemas, counters, debugLevel) {
  var resolved = resolveReference(schemaId, path, schemas);

  if (_.isArray(resolved)) {
    return dereferenceArraySchema(resolved, schemaId, path, schemas, counters, debugLevel);
  }
  if (!_.isPlainObject(resolved)) {
    return resolved;
  }

  return _.mapValues(resolved, function(value, name) {
    if (_.isString(value)) {
      // resolving $refs
      if (name === '$ref') {

        // ############### CIRCULAR REFERENCE DETECTION ################## //
        var normRef = normalizeReference(schemaId, path, schemas);
        var refNode = pointer.get(schemas[normRef.schemaId], normRef.path);
        var nodePath = normRef.schemaId + normRef.path;

        if (!_.has(counters, nodePath)) {
          counters[nodePath] = 0;
        }
        // break resolving if $ref in this subschema has been already resolved
        if (counters[nodePath] > RECURSION_LEVELS) {
          if (debugLevel > 0) {
            console.log('There is a circular reference ' + value.red + ' in ' + schemaId.yellow);
          }
          return {
            type: 'string',
            description: '__RECURSIVE',
            example: value + ' in: ' + schemaId
          };
        }
        counters[nodePath]++;
        // ############################################################## //

        // $ref points to other schema's root
        if (value.indexOf('#') === -1) {
          return dereferenceSchema(value, '#', schemas, _.clone(counters), debugLevel);
        }

        // dereference $ref's schema
        return dereferenceSchema(normRef.schemaId, value, schemas, _.clone(counters), debugLevel);
      }
      return value;
    }

    if (_.isNumber(value)) {
      return value;
    }

    if (_.isBoolean(value)) {
      return value;
    }

    if (_.isArray(value)) {
      return dereferenceArraySchema(value, schemaId, path, schemas, counters, debugLevel, name);
    }

    if (_.isPlainObject(value)) {
      return dereferenceSchema(schemaId, path + '/' + name, schemas, _.clone(counters), debugLevel);
    }
  });
};

/**
 * Similar to dereferenceSchema but expects and returns Array
 *
 * @param {Array} arraySchema - array of schemas (objects)
 * @param {String} schemaId
 * @param {String} path
 * @param {Object} schemas
 * @param {Number} debugLevel
 * @param {String} property - in case we need to include a prop name into the new path
 * @returns {Array} - resolved schemas, without $refs
 */
var dereferenceArraySchema = function(arraySchema, schemaId, path, schemas, counters, debugLevel, property) {
  return _.map(arraySchema, function(element, index) {
    if (_.isString(element) || _.isBoolean(element) || _.isNumber(element)) {
      return element;
    }
    if (property) {
      return dereferenceSchema(schemaId, path + '/' + property + '/' + index, schemas, _.clone(counters), debugLevel);
    }
    return dereferenceSchema(schemaId, path + '/' + index, schemas, _.clone(counters), debugLevel);
  });
}

/**
 * Make sure that combination of schemaId and path points to a valid path in the schemas
 *
 * @param {String} schemaId
 * @param {String} path
 * @param {Object} schemas
 * @returns {Object} - pair schemaId and path
 */
var normalizeReference = function(schemaId, path, schemas) {
  // test that schemaId exists
  if (!_.has(schemas, schemaId)) {
    throw new ReferenceError('Schema with ID ' + schemaId + ' not found.');
  }

  // split path by #
  var pathComponents = path.split(REFERENCE_SEPARATOR);

  // if it is internal reference use schemaId
  pathComponents[0] = pathComponents[0] || schemaId;

  // internal schema ref
  if (pathComponents[1]) {
    // again, make sure that schema ID exists
    if (!_.has(schemas, pathComponents[0])) {
      throw new ReferenceError('Bad reference: ' + path + ' (in: ' + schemaId + ')');
    }
    // test that full URI exists in the schemas
    var pointedSchema = pointer.get(schemas[pathComponents[0]], pathComponents[1]);
    if (!pointedSchema) {
      throw new ReferenceError('Bad reference: ' + path + ' (in: ' + schemaId + ')');
    }
    return {schemaId: pathComponents[0], path: pathComponents[1]};
  }
  return {schemaId: pathComponents[0], path: '#'};
};

/**
 * Replace string reference (path) by a schema object
 *
 * @param {String} schemaId
 * @param {String} path
 * @param {Object} schemas
 * @returns {Object}
 */
var resolveReference = function(schemaId, path, schemas) {
  var normRef = normalizeReference(schemaId, path, schemas);
  // $ref points to schema's root
  if (normRef.path === '#') {
    return schemas[normRef.schemaId];
  }
  return pointer.get(schemas[normRef.schemaId], normRef.path);
};

module.exports = {
  resolve: resolve,
  dereferenceSchemas: dereferenceSchemas,
  dereferenceSchema: dereferenceSchema,
  resolveReference: resolveReference,
  normalizeReference: normalizeReference
};
