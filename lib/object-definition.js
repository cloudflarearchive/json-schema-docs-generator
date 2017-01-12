'use strict';

var exampleExtractor = require('./example-data-extractor');
var JSONformatter = require('./formatters/json');
var _ = require('lodash');

/**
 * @param {Object} object
 * @param {Object} options
 * @param {Object} [options.formatter=JSONFormatter]- something that implements `.format(data)`
 * @constructor
 */
var ObjectDefinition = function(object, options) {
  options = options || {};
  this._formatter = options.formatter || JSONformatter;
  _.extend(this, this.build(object));
};

/**
 * The entrance method for building a full object definition
 *
 * @param {Object} object
 * @returns {{
 *   allProps: {},
 *   requiredProps: {},
 *   optionalProps: {},
 *   objects: Array,
 *   example: string,
 *   _original: Object
 * }}
 */
ObjectDefinition.prototype.build = function(object) {
  var required = object.required || [];
  var self = {
    // A map of properties defined by the object, if oneOf/anyOf is not defined
    allProps: {},
    // All required properties
    requiredProps: {},
    // Anything that isn't required
    optionalProps: {},
    // Nested definition objects for oneOf/anyOf cases
    objects: [],
    // Stringified example of the object
    example: ''
  }

  if (_.isArray(object.allOf)) {
    _.each(object.allOf, function(schema) {
      // Deep extend all properties
      _.merge(self, this.build(schema), function(a, b) {
        if (_.isArray(a)) {
          return a.concat(b);
        }
      });
    }, this);

  } else if (_.isArray(object.oneOf) || _.isArray(object.anyOf)) {
    var objects = object.oneOf || object.anyOf;
    self.objects = _.map(objects, this.build, this);

  } else if (_.isPlainObject(object.properties)) {
    _.extend(self.allProps, this.defineProperties(object.properties));

    if (_.isPlainObject(object.additionalProperties)) {
      _.extend(self.allProps, this.defineProperties(object.additionalProperties));
    }
  }

  // Allow oneOf/anyOf/allOf reference to also include additional properties
  if (_.isPlainObject(object.additionalProperties)) {
    var addtlProps = this.defineProperties(object.additionalProperties);
    _.each(self.objects, function(obj) {
      _.extend(obj.allProps, addtlProps);
    });
  }

  self.title = object.title;
  self.description = object.description;
  self.requiredProps = _.pick(self.allProps, required);
  if (_.isEmpty(self.requiredProps)) self.requiredProps = null;
  self.optionalProps = _.omit(self.allProps, required);
  if (_.isEmpty(self.optionalProps)) self.optionalProps = null;
  self._original = object;

  try {
    self.example = this._formatter.format(exampleExtractor.extract(object));
  } catch (e) {
    throw new Error('Error preparing data for object: ' + JSON.stringify(object));
  }

  //removes empty object properties (which are considered truthy in handlebars)
  self = _.pick(self, function(prop) {
      if (!(_.isObject(prop) && _.isEmpty(prop))) {
          return prop;
      }
  });

  return self;
};

/**
 * Expects to receive an object of properties, where the key is the property name
 * and the value is the definition of the property
 *
 * @param {Object} properties
 * @returns {Object}
 */
ObjectDefinition.prototype.defineProperties = function(properties) {
  return _.mapValues(properties, this.defineProperty, this);
};

/**
 * Clean up the definition by generating an example value (stringified),
 * handling types for enums, and following other schema directives.
 *
 * @param {Object} property
 * @returns {Object}
 */
ObjectDefinition.prototype.defineProperty = function(property) {
  var definition = {};
  // Determine the appropriate type
  if (property.enum) {
    definition.type = typeof property.enum[0];
  } else {
    definition.type = property.type;
  }

  // Stringify the example
  definition.example = this.getExampleFromProperty(property);

  // If a definition is pointed to another schema that is an `allOf` reference,
  // resolve it so the statements below will catch `definition.properties`
  if (property.allOf) {
    definition.properties = this.build(property).allProps;

  // If an attribute can be multiple types, store each parameter object
  // under its appropriate type
  } else if (property.oneOf || property.anyOf) {
    var key = property.oneOf ? 'oneOf' : 'anyOf';
    definition[key] = _.map(property.oneOf || property.anyOf, this.build, this);

  // If the property value is an object and has its own properties,
  // make them available to the definition
  } else if (property.properties) {
    definition.properties = this.defineProperties(property.properties);
  }

  return _.defaults(definition, property);
};

/**
 *
 * @param property
 * @return {String}
 */
ObjectDefinition.prototype.getExampleFromProperty = function(property) {
  var extracted = exampleExtractor.mapPropertiesToExamples({
    prop: property
  });
  // Stringify the example
  return this._formatter.format(extracted.prop);
}

/**
 * @class ObjectDefinition
 * @module lib/object-definition
 * @type {Function}
 */
module.exports = ObjectDefinition;
