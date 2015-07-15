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
  this.formatter = options.formatter || JSONformatter;
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
    example: '',
    // Original input object
    _original: object
  }

  _.extend(self, _.pick(object, ['title', 'description']));

  if (_.isArray(object.allOf)) {
    _.each(object.allOf, function(schema) {
      _.merge(self, this.build(schema), function(a, b) {
        if (_.isArray(a)) {
          return a.concat(b);
        }
      });
    }, this);

  } else if (_.isArray(object.oneOf) || _.isArray(object.anyOf)) {
    var objects = object.oneOf || object.anyOf;
    self.objects = _.map(objects, this.build, this);

    // @TODO is this needed?
    // _.each(map.objects, function(obj){
    //   obj.example = this.formatter.format(exampleExtractor.generate(object, obj._original, {
    //       includeAdditionalRootProps: true
    //   }));
    // }, this);

  } else if (_.isPlainObject(object.properties)) {
    _.extend(self.allProps, this.defineProperties(object.properties));

    if (_.isPlainObject(object.additionalProperties)) {
      _.extend(self.allProps, this.defineProperties(object.additionalProperties));
    }
  }

  self.requiredProps = _.pick(self.allProps, required);
  self.optionalProps = _.omit(self.allProps, required);
  self.example = this.formatter.format(exampleExtractor.extract(object));

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
  // `items` is defined on arrays, so it's easier to look up
  // this source first to generate an example dataset
  var propertySource = property.items || property;
  var definition = {};
  var example;
  // Determine the appropriate type
  if (property.enum) {
    definition.type = typeof property.enum[0];
  } else {
    definition.type = property.type;
  }

  example = exampleExtractor.getExampleDataFromItem(propertySource);
  // If the source is a valid schema, and no example was provided, go resolve that
  if (_.isUndefined(example) && propertySource.id) {
    example = exampleExtractor.extract(propertySource);
  } else if (definition.type === 'array') {
    example = [example];
  }
  // Stringify the example
  definition.example = this.formatter.format(example);

  // If a definition is pointed to another schema that is an `allOf` reference,
  // resolve it so the statements below will catch `definition.properties`
  if (property.allOf) {
    definition.properties = this.build(definition).allProps;

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

  return definition;
};

/**
 * @class ObjectDefinition
 * @module lib/object-definition
 * @type {Function}
 */
module.exports = ObjectDefinition;
