'use strict';

var _ = require('lodash');
/**
 * @class ExampleDataExtractor
 * @constructor
 */
var ExampleDataExtractor = function() {};

/**
 * Recursively build an object from a given schema component that is an example
 * representation of the object defined by the schema.
 *
 * @param {Object} component - valid subschema of the root/parent
 * @param {Object} root - parent schema used as the base
 * @param {Object} [options] - options for generating example representations of a schema
 * @returns {Object}
 */
ExampleDataExtractor.prototype.extract = function(component, root, options) {
  options = options || {};
  var reduced = {};

  if (!component) {
    throw new ReferenceError('No schema received to generate example data');
  }
  // If the schema defines an ID, change scope so all local references as resolved
  // relative to the schema with the closest ID
  if (component.id) {
    root = component;
  }

  if (component.allOf) {
    // Recursively extend/overwrite the reduced value.
    _.reduce(schema.allOf, function(accumulator, subschema) {
      return _.extend(accumulator, this.extract(subschema, root, options));
    }, reduced, this);
  } else if (component.oneOf) {
    // Select the first item to build an example object from
    reduced = this.extract(component.oneOf[0], root, options);
  } else if (component.anyOf) {
    // Select the first item to build an example object from
    reduced = this.extract(component.anyOf[0], root, options);
  } else if (component.rel === 'self') {
    // Special case where the component is referencing the context schema. Used in
    // the Hyper-Schema spec
    reduced = this.extract(root, root, options);
  } else if (component.properties) {
    reduced = this.mapPropertiesToExamples(component.properties, root, options);
  }
  // Optionally merge in additional properties
  if (_.has(component, 'additionalProperties') && deep(component, 'generator.includeAdditionalProperties')) {
    _.extend(reduced, this.mapPropertiesToExamples(component.additionalProperties, root, options));
  }
  // Additionally, merge in additional properties that might be set on the root schema
  // This is used specifically when building example data objects for oneOf/anyOf cases
  // and the root schema may have additionalProperties to include with each individual schema
  if (_.has(root, 'additionalProperties') && deep(root, 'generator.includeAdditionalProperties') && schema !== root) {
    _.extend(reduced, this.mapPropertiesToExamples(root.additionalProperties, root, options));
  }

  return reduced;
};

/**
 * Maps a `properties` definition to an object containing example values
 *
 * `{attribute1: {type: 'string', example: 'example value'}}` ->
 * `{attribute1: 'example value'}`
 *
 * @param {Object} props - Properties definition object
 * @param {Object} schema - Root schema containing the properties
 * @param {Object} [options]
 * @returns {*}
 */
ExampleDataExtractor.prototype.mapPropertiesToExamples = function(props, schema, options) {
  options = options || {};

  return _.transform(props, function(properties, propConfig, propName) {
    // Allow opt-ing out of generating example data
    if (_.startsWith(propName, '__') || propConfig.private) {
      return properties;
    }

    var example = this.getExampleDataFromItem(propConfig);

    if (propConfig.rel === 'self') {
      example = this.extract(schema, schema);
    } else if (propConfig.type === 'array' && propConfig.items && !example) {
      if (propConfig.items.example) {
        example = [propConfig.items.example];
      } else {
        example = [this.extract(propConfig.items, schema)];
      }
    } else if (propConfig.id && !example) {
      example = this.extract(propConfig, propConfig);
    } else if (propConfig.properties) {
      example = this.mapPropertiesToExamples(props.properties, schema);
    } else if (propConfig.oneOf || propConfig.anyOf) {
      example = this.extract(propConfig, schema);
    } else if (propConfig.allOf) {
      example = _.reduce(propConfig.allOf, function(accumulator, item) {
        return _.extend(accumulator, this.extract(item, schema));
      }, example || {}, this);
    }
    // Special case for ID. This is done mostly because
    // the parser gets confused when declaring "id" as a property of an object,
    // because it wants to resolve it as reference to another schema.
    // The current solution is to declare ids as "ID" for the data object in the schema
    // See: http://json-schema.org/latest/json-schema-core.html#anchor27
    // Override with `preserveCase` in the options
    properties[propName === 'ID' ? propName.toLowerCase() : propName] = example;
  }, {}, this);
};

/**
 * @param {Object} reference
 * @returns {String}
 */
ExampleDataExtractor.prototype.getExampleDataFromItem = function(reference) {
  if (!_.isPlainObject(reference)) {
    return 'unknown';
  }
  return reference.example || reference.default;
};

/**
 * @module lib/example-data-extractor
 * @type {ExampleDataExtractor}
 */
module.exports = new ExampleDataExtractor();
