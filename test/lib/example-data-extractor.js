'use strict';
/* globals: describe, it */

var expect = require('chai').expect;
var resolver = require('../../lib/resolver');
var extractor = require('../../lib/example-data-extractor');
var schema1 = require('../fixtures/schema1.json');
var schema2 = require('../fixtures/schema2.json');
var _ = require('lodash');

/** @name describe @function */
/** @name it @function */
/** @name before @function */
/** @name after @function */
/** @name beforeEach @function */
/** @name afterEach @function */

describe('Example Data Extractor', function() {
  // @TODO Figure out a better way isolate these tests
  before(function() {
    this.schemas = resolver.resolve([schema1, schema2]);
    this.schema1 = this.schemas['/fixtures/foo'];
    this.schema2 = this.schemas['/fixtures/baz'];
  });

  describe('#getExampleDataFromItem', function() {
    it('should return "unknown" if the reference is not an object', function() {
      expect(extractor.getExampleDataFromItem([1])).to.equal('unknown');
    });

    it('should return the value found in the "example" attribute', function() {
      expect(extractor.getExampleDataFromItem({
        example: 'my value'
      })).to.equal('my value');
    });

    it('should return the value found in the "default" attribute if "example" is not defined', function() {
      expect(extractor.getExampleDataFromItem({
        default: 'my value'
      })).to.equal('my value');
    });
  });

  describe('#mapPropertiesToExamples', function() {
    beforeEach(function() {
      this.example = extractor.mapPropertiesToExamples(this.schema1.properties, this.schema1);
      // Makes tests easier to write
      this.properties = _.keys(this.schema1.properties);
      this.properties[this.properties.indexOf('ID')] = 'id';
    });

    it('should build example values from the given property definitions', function() {
      expect(this.example).to.be.an('object');
      expect(this.example).to.have.keys(this.properties);
      expect(this.example.foo, 'internal reference').to.equal('bar');
      expect(this.example.baz, 'external reference').to.equal('boo');
      expect(this.example.boo, 'oneOf reference').to.have.property('attribute_one').that.equals('One');
    });

    it('should merge allOf objects together', function() {
      expect(this.example.composite).to.be.an('object');
      expect(this.example.composite).to.have.keys(['attribute_one', 'attribute_two']);
      expect(this.example.composite).to.have.property('attribute_one').that.equals('One');
      expect(this.example.composite).to.have.property('attribute_two').that.equals('Two');
    });

    it('should resolve rel=self references', function() {
      var obj = extractor.mapPropertiesToExamples({
        key: {
          rel: 'self'
        }
      }, this.schema1);
      expect(obj).to.be.an('object');
      expect(obj.key).to.contain.keys(this.properties);
    });

    it('should follow nested schema references', function() {
      expect(this.example.nested_object).to.have.keys(_.keys(this.schema2.properties));
    });

    it('should lowercase ID property references', function() {
      expect(this.example).to.not.contain.key('ID');
      expect(this.example).to.contain.key('id');
    });

    it('should resolve the first oneOf reference', function() {
      expect(this.example.boo).to.have.property('attribute_one').that.equals('One');
    });

    it('should resolve the first anyOf reference', function() {
      expect(this.example.option).to.have.property('attribute_two').that.equals('Two');
    });

    it('should resolve array references', function() {
      expect(this.example.array_prop).to.be.an('array');
    });
  });

  describe('#extract', function() {
    beforeEach(function() {
      this.example = extractor.extract(this.schema1, this.schema1);
    });

    it('should return an example that is the defined type', function() {
      expect(this.example).to.be.an(this.schema1.type);
    });

    it('should merge allOf references together', function() {
      expect(this.example).to.have.property('composite').that.has.keys(['attribute_one', 'attribute_two']);
    });

    it('should use the first item in oneOf references', function() {
      expect(this.example).to.have.property('boo').that.has.key('attribute_one');
    });

    it('should use the first item in anyOf references', function() {
      expect(this.example).to.have.property('option').that.has.key('attribute_two');
    });

    it('should resolve rel=self references', function() {
      expect(extractor.extract({
        key: {
          rel: 'self'
        }
      }, this.schema1)).to.be.an('object');
    });

    it('should include additional properties', function() {
      expect(this.example).to.have.property('plus_one').that.is.not.empty;
    });
  });
});
