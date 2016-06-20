'use strict';
/* globals: describe, it, beforeEach */

var _ = require('lodash');
var expect = require('chai').expect;
var resolver = require('../../lib/resolver2');
var schema1 = require('../fixtures/schema1.json');
var schema2 = require('../fixtures/schema2.json');
var schemaPageRules = require('../fixtures/schema-pagerules.json');
var schemaRec1 = require('../fixtures/schema-recursion1.json');
var schemaRec2 = require('../fixtures/schema-recursion2.json');


/** @name describe @function */
/** @name it @function */
/** @name before @function */
/** @name after @function */
/** @name beforeEach @function */
/** @name afterEach @function */

describe('Resolver', function() {
  beforeEach(function() {
    this.schema1 = _.cloneDeep(schema1);
    this.schema2 = _.cloneDeep(schema2);
    this.schemaRec1 = _.cloneDeep(schemaRec1);
    this.schemaRec2 = _.cloneDeep(schemaRec2);
    this.schemaPageRules = _.cloneDeep(schemaPageRules);
    this.schemas = {};
    this.schemas[this.schema1.id] = this.schema1;
    this.schemas[this.schema2.id] = this.schema2;
    this.schemas[this.schemaRec1.id] = this.schemaRec1;
    this.schemas[this.schemaRec2.id] = this.schemaRec2;
    this.schemas[this.schemaPageRules.id] = this.schemaPageRules;
    this.resolver = resolver;
  });

  describe('#normalizeReference', function() {
    it('should prepend the schemaId if the reference is internal', function() {
      var schemaId = '/fixtures/foo';
      var path = '#/definitions/foo_prop';

      expect(this.resolver.normalizeReference(schemaId, path, this.schemas))
        .to.deep.equal({schemaId: '/fixtures/foo', path: '/definitions/foo_prop'});
    });

    it('should switch to a schemaId definied in the reference', function() {
      var schemaId = '/fixtures/foo';
      var path = '/fixtures/baz';

      expect(this.resolver.normalizeReference(schemaId, path, this.schemas))
        .to.deep.equal({schemaId: '/fixtures/baz', path: '#'});
    });

    it('should use schemaId and path definied in the reference', function() {
      var schemaId = '/fixtures/foo';
      var path = '/fixtures/baz#/definitions/identifier';

      expect(this.resolver.normalizeReference(schemaId, path, this.schemas))
        .to.deep.equal({schemaId: '/fixtures/baz', path: '/definitions/identifier'});
    });

    it('should use schemaId and path definied in the reference', function() {
      var schemaId = '/fixtures/foo';
      var path = '/fixtures/baz#/definitions/identifier';

      expect(this.resolver.normalizeReference(schemaId, path, this.schemas))
        .to.deep.equal({schemaId: '/fixtures/baz', path: '/definitions/identifier'});
    });

    it('should throw an error if schemaId does not exist', function() {
      var schemaId = '/fixtures/not/existing';
      expect(_.bindKey(this.resolver, 'normalizeReference', schemaId, '#', this.schemas), 'wrong schemaId')
        .to.throw(ReferenceError);
    });

    it('should throw an error if the reference does not resolve into a valid schema path', function() {
      var schemaId = '/fixtures/foo';
      var path = '#/definitions/not/existing';

      expect(_.bindKey(this.resolver, 'normalizeReference', schemaId, path, this.schemas), 'wrong path')
        .to.throw(ReferenceError);
    });

  });

  describe('#resolveReference', function() {
    it('should resolve the reference for a relative URI with proper schemaId', function() {
      expect(this.resolver.resolveReference('/fixtures/foo', '#/definitions/foo_prop', this.schemas))
        .to.be.an('object')
        .that.has.keys(['type', 'description', 'example']);
    });

    it('should resolve a fully qualified reference', function() {
      expect(this.resolver.resolveReference('/fixtures/baz', '/fixtures/foo#/definitions/foo_prop', this.schemas))
        .to.be.an('object')
        .that.has.keys(['type', 'description', 'example']);
    });

    it('should resolve a fully qualified reference without path', function() {
      expect(this.resolver.resolveReference('/fixtures/baz', '/fixtures/foo', this.schemas))
        .to.be.an('object')
        .that.contains.keys(['id', 'definitions', 'properties', 'generator']);
    });
  });

  describe('#initCounters', function() {
    it('should add counter to all object nodes', function() {
      this.resolver.initCounters(this.schema1);
      expect(this.schema1).that.contains.keys(['__COUNTER', 'definitions']);
      expect(this.schema1.definitions).that.contains.keys(['__COUNTER']);
    });

    it('should set counters to 0', function() {
      this.resolver.initCounters(this.schema1);
      expect(this.schema1.__COUNTER).equals(0);
      expect(this.schema1.definitions.__COUNTER).equals(0);
    });
  });

  describe('#resolve', function() {
    it('should return newly build schemas', function() {
      expect(this.resolver.resolve(this.schemas))
        .that.contains.keys(['/fixtures/baz', '/fixtures/foo']);
    });
  });

  describe('#dereferenceSchema', function() {
    it('should replace $ref references with the resolved schema', function() {
      expect(this.schema1.properties.foo.$ref, 'properties, definition reference').to.be.a('string');
      expect(this.schema1.properties.baz.$ref, 'properties, definition reference (external ref)').to.be.a('string');
      expect(this.schema1.definitions.baz_prop.$ref, 'definitions, external reference').to.be.a('string');
      expect(this.schema1.links[0].schema.properties.foo.$ref, 'deep object in array').to.be.a('string');
      expect(this.schema1.properties.boo.oneOf[0].$ref, '$ref object in array').to.be.a('string');

      _.forEach(this.schemas, this.resolver.initCounters);
      var schema = this.resolver.dereferenceSchema('/fixtures/foo', '#', this.schemas);

      expect(schema.properties.foo.$ref, 'properties, definition reference').to.be.a('object');
      expect(schema.properties.baz.$ref, 'properties, definition reference (external ref)').to.be.a('object');
      expect(schema.definitions.baz_prop.$ref, 'definitions, external reference').to.be.a('object');
      expect(schema.links[0].schema.properties.foo.$ref, 'deep object in array').to.be.a('object');
      expect(schema.properties.boo.oneOf[0].$ref, '$ref object in array').to.be.a('object');
    });
  });

});
