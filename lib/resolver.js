/**
 * Schema resolver
 * Recursively resolves reference from an array or object of schemas
 *
 * @module lib/resolver
 */
'use strict';

var _ = require('lodash');
var colors = require('colors');
var pointer = require('./pointer');
var flatnest = require('flatnest');

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
  // augmentedSchemas is used as a graph, deep cloned so we don't mutate the input
  var augmentedSchemas = _.cloneDeep(schemas);
  // transform schemas into keyd object if we got an array
  if (_.isArray(augmentedSchemas)) {
    augmentedSchemas = _.reduce(augmentedSchemas, function(obj, schema) {
      obj[schema.id] = schema;
      return obj;
    }, {});
  }

  // init counters
  _.forEach(augmentedSchemas, initCounters);

  // dereferenceSchemas
  var result = dereferenceSchemas(augmentedSchemas);

  // remove counters
  _.forEach(result, removeCounters);

  // remove (flat) $ref props
  var finalResult = {};
  _.forEach(flatnest.flatten(result), function(value, prop) {
    finalResult[prop.replace(/\.\$ref/g, '')] = value;
  });

  return flatnest.nest(finalResult);
}

/**
 *
 * @param {Object} augmentedSchemas
 * @param {Number} debugLevel
 * @returns {Object}
 */
var dereferenceSchemas = function(augmentedSchemas, debugLevel) {
  return _.mapValues(augmentedSchemas, function(schema) {
    return dereferenceSchema(schema.id, '#', _.cloneDeep(augmentedSchemas), debugLevel);
  });
}

/**
 * The heavy lifter. This is a recursive function that will traverse over each key in
 * the given graph (augmentedSchemas) and builds a new schema, where all $refs are
 * resolved.
 *
 * @param {String} schemaId - top level schema ID, context for internal resolutions
 * @param {String} path - JSON pointer of the graph node that we are dereferencing
 * @param {Object} graph - augmentedSchemas, our "recipe" for building new schemas
 * @param {Number} debugLevel
 * @returns {Object} - resolved schema, without $refs
 */
var dereferenceSchema = function(schemaId, path, graph, debugLevel) {
  return _.mapValues(resolveReference(schemaId, path, graph), function(value, name) {
    if (_.isString(value)) {
      // resolving $refs
      if (name === '$ref') {

        // ############### CIRCULAR REFERENCE DETECTION ################## //
        var normRef = normalizeReference(schemaId, path, graph);
        var refNode = pointer.get(graph[normRef.schemaId], normRef.path);
        // break resolving if $ref in this subgraph has been already resolved
        if (refNode.__COUNTER > RECURSION_LEVELS) {
          if (debugLevel > 0) {
            console.log('There is a circular reference ' + value.red + ' in ' + schemaId.yellow);
          }
          return {
            type: 'string',
            description: '__RECURSIVE',
            example: value + ' in: ' + schemaId
          };
        }
        refNode.__COUNTER++;
        // ############################################################## //

        // $ref points to other schema's root
        if (value.indexOf('#') === -1) {
          return dereferenceSchema(value, '#', _.cloneDeep(graph), debugLevel);
        }

        // dereference $ref's schema
        return dereferenceSchema(normRef.schemaId, value, _.cloneDeep(graph), debugLevel);
      }
      return value;
    }

    // don't copy __COUNTER property
    if (_.isNumber(value) && name !== '__COUNTER') {
      return value;
    }

    if (_.isBoolean(value)) {
      return value;
    }

    if (_.isArray(value)) {
      return _.map(value, function(element, index) {
        if (_.isString(element)) {
          return element;
        }
        // since the property is array we have to iterate over its elements
        return dereferenceSchema(schemaId, path + '/' + name + '/' + index, _.cloneDeep(graph), debugLevel);
      });
    }

    if (_.isPlainObject(value)) {
      return dereferenceSchema(schemaId, path + '/' + name, _.cloneDeep(graph), debugLevel);
    }
  });
}

/**
 * Add extra property "__COUNTER: 0" to every object node, recursively mutates the schema
 *
 * @param {Object} schema
 * @returns {Object}
 */
var initCounters = function(schema) {
  if (!_.isPlainObject(schema)) return;
  schema.__COUNTER = 0;
  _.forEach(schema, function(subSchema) {
    if (_.isArray(subSchema)) {
      _.forEach(subSchema, initCounters);
    }
    initCounters(subSchema);
  });
}

/**
 * Remove property "__COUNTER" at every object node, recursively mutates the schema
 *
 * @param {Object} schema
 * @returns {Object}
 */
var removeCounters = function(schema) {
  if (!_.isPlainObject(schema)) return;
  delete schema.__COUNTER;
  _.forEach(schema, function(subSchema) {
    if (_.isArray(subSchema)) {
      _.forEach(subSchema, removeCounters);
    }
    removeCounters(subSchema);
  });
}

/**
 * Make sure that combination of schemaId and path points to a valid path in the graph
 *
 * @param {String} schemaId
 * @param {String} path
 * @param {Object} graph
 * @returns {Object} - pair schemaId and path
 */
var normalizeReference = function(schemaId, path, graph) {
  // test that schemaId exists
  if (!_.has(graph, schemaId)) {
    throw new ReferenceError('Schema with ID ' + schemaId + ' not found.');
  }

  // split path by #
  var pathComponents = path.split(REFERENCE_SEPARATOR);

  // if it is internal reference use schemaId
  pathComponents[0] = pathComponents[0] || schemaId;

  // internal schema ref
  if (pathComponents[1]) {
    // again, make sure that schema ID exists
    if (!_.has(graph, pathComponents[0])) {
      throw new ReferenceError('Bad reference: ' + path + ' (in: ' + schemaId + ')');
    }
    // test that full URI exists in the graph
    var pointedSchema = pointer.get(graph[pathComponents[0]], pathComponents[1]);
    if (!pointedSchema) {
      throw new ReferenceError('Bad reference: ' + path + ' (in: ' + schemaId + ')');
    }
    return {schemaId: pathComponents[0], path: pathComponents[1]};
  }
  return {schemaId: pathComponents[0], path: '#'};
}

/**
 * Replace string reference (path) by a schema object
 *
 * @param {String} schemaId
 * @param {String} path
 * @param {Object} graph
 * @returns {Object}
 */
var resolveReference = function(schemaId, path, graph) {
  var normRef = normalizeReference(schemaId, path, graph);
  // $ref points to schema's root
  if (normRef.path === '#') {
    return _.cloneDeep(graph[normRef.schemaId]);
  }
  return _.cloneDeep(pointer.get(graph[normRef.schemaId], normRef.path));
};

module.exports = {
  resolve: resolve,
  dereferenceSchemas: dereferenceSchemas,
  dereferenceSchema: dereferenceSchema,
  resolveReference: resolveReference,
  normalizeReference: normalizeReference,
  initCounters: initCounters
}
