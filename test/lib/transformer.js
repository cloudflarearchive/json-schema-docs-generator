'use strict';
/* globals: describe, it */

var expect = require('chai').expect;
var Resolver = require('../../lib/resolver');
var Transformer = require('../../lib/transformer');
var schema1 = require('../fixtures/schema1.json');
var schema2 = require('../fixtures/schema2.json');
var _ = require('lodash');

/** @name describe @function */
/** @name it @function */
/** @name before @function */
/** @name after @function */
/** @name beforeEach @function */
/** @name afterEach @function */

describe('Schema Transformer', function() {
  // @TODO Figure out a better way isolate these tests
  before(function() {
    this.schema1 = _.cloneDeep(schema1);
    this.schema2 = _.cloneDeep(schema2);
    this.schemas = [this.schema1, this.schema2];
    this.resolver = new Resolver(this.schemas);
    this.resolver.resolve();
  });

  beforeEach(function() {
    this.transformer = new Transformer(this.schemas);
  });

  describe('#buildHref', function() {
    it('should replace references with placeholders', function() {
      expect(this.transformer.buildHref(this.schema1.links[1].href, this.schema1)).to.equal('/fixtures/foos/:identifier');
    });

    it('should replace references with example data', function() {
      expect(this.transformer.buildHref(this.schema1.links[1].href, this.schema1, true)).to.equal('/fixtures/foos/123');
    });

    it('should throw an error if it cannot resolve a reference', function() {
      expect(_.bind(function() {
        this.transformer.buildHref('/foo/bar/{#/not/a/place}', this.schema1)
      }, this)).to.throw(Error);
    });
  });

  describe('#generateExample', function() {
    beforeEach(function() {
      this.example = this.transformer.generateExample(this.schema1.links[0].schema, this.schema1);
    });

    it('should return an object', function() {
      expect(this.example).to.be.an('object');
    });

    it('should fill attribute definitions with example values', function() {
      expect(this.example).to.have.property('foo').that.equals('bar');
    });

    it('should build an example for the whole object', function() {
      this.example = this.transformer.generateExample(this.schema1, this.schema1);
      expect(this.example).to.be.an('object');
      expect(this.example).to.have.keys(['id', 'foo', 'baz', 'boo', 'composite', 'nested_object']);
      expect(this.example.id).to.equal(123);
      expect(this.example.foo).to.equal('bar');
      expect(this.example.baz).to.equal('boo');
      expect(this.example.boo).to.eql({
        attribute_one: 'One'
      });
      expect(this.example.composite).to.eql({
        attribute_one: 'One',
        attribute_two: 'Two'
      });
      expect(this.example.nested_object).to.not.be.empty;
    });
  });

  describe('#transformLinks', function() {
    it('should return an array', function() {
      expect(this.transformer.transformLinks(this.schema1, this.schema1.links)).to.be.an('array');
    });
  });

  describe('#transformLink', function() {
    beforeEach(function() {
      this.link = this.transformer.transformLink(this.schema1, this.schema1.links[0]);
    });

    it('should contain an html ID', function() {
      expect(this.link).to.have.property('htmlID').that.is.a('string');
    });

    it('should have a URI', function() {
      expect(this.link).to.have.property('uri').that.is.a('string');
    });

    it('should have a curl', function() {
      expect(this.link).to.have.property('curl').that.is.a('string');
    });

    it('should have a formatted response', function() {
      expect(this.link).to.have.property('response').that.is.a('string');
    });

    it('should have input parameters');
  });
});
