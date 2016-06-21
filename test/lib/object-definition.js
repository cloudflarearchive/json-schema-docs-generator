'use strict';
/* globals: describe, it */

var sinon = require('sinon');
var chai = require('chai');
var expect = chai.expect;
var resolver = require('../../lib/resolver');
var ObjectDefinition = require('../../lib/object-definition');
var schema1 = require('../fixtures/schema1.json');
var schema2 = require('../fixtures/schema2.json');
var _ = require('lodash');

chai.use(require('sinon-chai'));

/** @name describe @function */
/** @name it @function */
/** @name before @function */
/** @name after @function */
/** @name beforeEach @function */
/** @name afterEach @function */

describe('Object Definition', function() {
  // @TODO Figure out a better way isolate these tests
  before(function() {
    this.schemas = resolver.resolve([schema1, schema2]);
    this.schema1 = this.schemas['/fixtures/foo'];
    this.schema2 = this.schemas['/fixtures/baz'];
  });

  beforeEach(function() {
    this.definitionObjectKeys = ['title', 'description', 'allProps', 'requiredProps', 'optionalProps', 'objects', 'example', '_original'];
    this.definition = new ObjectDefinition(this.schema1);
    this.linkDefinition = new ObjectDefinition(this.schema1.links[2].schema);
  });

  describe('#constructor', function() {
    it('should assign a formatter if one is not provided', function() {
      expect(this.definition).to.have.property('_formatter').that.is.not.undefined;
    });

    it('should use the provided formatter', function() {
      var formatter = {
        format: _.identity
      };
      this.definition = new ObjectDefinition(this.schema1, {
        formatter: formatter
      });
      expect(this.definition).to.have.property('_formatter').that.equals(formatter);
    });

    it('should call build on instantiation', function() {
      var spy = sinon.spy(ObjectDefinition.prototype, 'build');
      this.definition = new ObjectDefinition(this.schema1);
      expect(spy).to.have.been.called;
      spy.restore();
    });

    it('should merge results of build into itself', function() {
      expect(this.definition).to.contain.keys(this.definitionObjectKeys);
    });
  });

  describe('#build', function() {
    beforeEach(function() {
      this.allOfSchema = {
        id: '/someid',
        allOf: [
          this.schema1.definitions.object_one,
          this.schema1.definitions.object_two
        ]
      };
    });

    it('should provide access to the original object', function() {
      expect(this.definition).to.have.property('_original').that.equals(this.schema1);
    });

    it('should return an object with the correct attributes', function() {
      expect(this.definition.build(this.schema1)).to.contain.keys(this.definitionObjectKeys);
    });

    it('should return required properites when defined', function() {
      expect(this.linkDefinition.requiredProps).to.have.keys(['foo', 'baz']);
    });

    it('should include all properties found', function() {
      expect(this.linkDefinition.allProps).to.have.keys(['foo', 'baz', 'boo']);
    });

    it('should only include optional properties', function() {
      expect(this.linkDefinition.optionalProps).to.have.key('boo');
      expect(this.linkDefinition.optionalProps).to.not.have.keys(['foo', 'baz']);
    });

    it('should merge allOf references together', function() {
      var result = this.definition.build(this.allOfSchema);
      expect(result).to.have.property('allProps').that.has.keys(['attribute_one', 'attribute_two']);
    });

    it('should not overwrite the _original property when merging allOf references', function() {
      var result = this.definition.build(this.allOfSchema);
      expect(result).to.have.property('_original').that.equals(this.allOfSchema);
      expect(result._original).to.have.property('id').that.equals('/someid');
    });

    it('should build an array of definition objects for oneOf references', function() {
      var schema  = {
        oneOf: [
          this.schema1.definitions.object_one,
          this.schema1.definitions.object_two
        ]
      };
      var result = this.definition.build(schema);
      expect(result).to.have.property('objects').that.is.an('array');
      expect(result.objects).to.have.length(2);
      expect(result.objects[0], 'first object').to.have.keys(this.definitionObjectKeys);
      expect(result.objects[1], 'second object').to.have.keys(this.definitionObjectKeys);
    });

    it('should build an array of definition objects for anyOf references', function() {
      var schema  = {
        anyOf: [
          this.schema1.definitions.object_one,
          this.schema1.definitions.object_two
        ]
      };
      var result = this.definition.build(schema);
      expect(result).to.have.property('objects').that.is.an('array');
      expect(result.objects).to.have.length(2);
      expect(result.objects[0], 'first object').to.have.keys(this.definitionObjectKeys);
      expect(result.objects[1], 'second object').to.have.keys(this.definitionObjectKeys);
    });

    it('should include additional properties in all props when defined', function() {
      expect(this.definition.allProps).to.contain.key('plus_one');
    });

    it('should build an example', function() {
      expect(this.definition.example).to.be.a('string').with.length.above(2);
      expect(this.definition.example).to.contain('id');
      expect(this.definition.example).to.contain('foo');
      expect(this.definition.example).to.contain('baz');
      expect(this.definition.example).to.contain('boo');
      expect(this.definition.example).to.contain('option');
      expect(this.definition.example).to.contain('composite');
      expect(this.definition.example).to.contain('nested_object');
      expect(this.definition.example).to.contain('array_prop');
      expect(this.definition.example).to.contain('plus_one');
    });
  });

  describe('#defineProperties', function() {
    it('should return an object with the same keys', function() {
      expect(this.definition.defineProperties(this.schema1.properties)).to.be.an('object').with.keys(_.keys(this.schema1.properties));
    });
  });

  describe('#defineProperty', function() {
    it('should return an object', function() {
      expect(this.definition.defineProperty({})).to.be.an('object');
    });

    it('should include a type defined by the property', function() {
      expect(this.definition.defineProperty({
        type: 'string'
      })).to.have.property('type').that.equals('string');
    });

    it('should derive a type from an enum', function() {
      expect(this.definition.defineProperty({
        enum: ['a', 'b', 'c']
      }), 'string').to.have.property('type').that.equals('string');

      expect(this.definition.defineProperty({
        enum: [1, 2, 3]
      }), 'number').to.have.property('type').that.equals('number');

      expect(this.definition.defineProperty({
        enum: [{a: 1}, {b: 2}, {c: 3}]
      }), 'object').to.have.property('type').that.equals('object');

      expect(this.definition.defineProperty({
        enum: [true, false]
      }), 'boolean').to.have.property('type').that.equals('boolean');
    });

    it('should define an example', function() {
      expect(this.definition.defineProperty({
        type: 'string',
        example: 'abc'
      })).to.have.property('example').that.equals('"abc"');
    });

    it('should use the default when no example is defined', function() {
      expect(this.definition.defineProperty({
        type: 'string',
        default: 'abc'
      })).to.have.property('example').that.equals('"abc"');
    });

    it('should merge allOf references to build a properties list', function() {
      expect(this.definition.defineProperty(this.schema1.properties.composite)).to.have.property('properties').that.has.keys(['attribute_one', 'attribute_two']);
    });

    it('should map object definitions to oneOf references', function() {
      expect(this.definition.defineProperty(this.schema1.properties.boo)).to.have.property('oneOf').that.has.length(2);
    });

    it('should map object definitions to anyOf references', function() {
      expect(this.definition.defineProperty(this.schema1.properties.option)).to.have.property('anyOf').that.has.length(2);
    });

    it('should define deep properties', function() {
      expect(this.definition.defineProperty(this.schema1)).to.have.property('properties').that.has.keys(_.keys(this.schema1.properties));
    });

    it('should include any arbitrary attributes defined on the property', function() {
      expect(this.definition.defineProperty({
        type: 'string',
        example: 'abc',
        my_prop: 123
      })).to.have.property('my_prop').that.equals(123);
    });
  });

  describe('#getExampleFromProperty', function() {
    it('return a string', function() {
      expect(this.definition.getExampleFromProperty({
        example: 'abc'
      }), 'string').to.be.a('string');

      expect(this.definition.getExampleFromProperty({
        example: 213
      }), 'number').to.be.a('string');

      expect(this.definition.getExampleFromProperty({
        example: {
          a: 1
        }
      }), 'object').to.be.a('string');

      expect(this.definition.getExampleFromProperty({
        example: false
      }), 'false').to.be.a('string');

      expect(this.definition.getExampleFromProperty({
        example: true
      }), 'true').to.be.a('string');
    });

    it('should resolve an example if a valid schema is detected', function() {
      var example = this.definition.getExampleFromProperty(this.schema1);
      expect(example).to.contain('{');
      expect(example).to.contain('foo');
      expect(example).to.contain('baz');
      expect(example).to.contain('option');
    });

    it('should detect if the property is an array', function() {
      var example = this.definition.getExampleFromProperty(this.schema1.properties.array_prop);
      expect(example).to.not.equal('[]');
      expect(example).to.contain('[');
      expect(example).to.contain(']');
    });
  });
});
