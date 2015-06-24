'use strict';
/* globals: describe, it, beforeEach */

var _ = require('lodash');
var expect = require('chai').expect;
var Resolver = require('../../lib/resolver');
var schema1 = require('../fixtures/schema1.json');
var schema2 = require('../fixtures/schema2.json');

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
    this.schemas = [this.schema1, this.schema2];
    this.resolver = new Resolver(this.schemas);
  });

  describe('#_normalizeReference', function() {
    it('should prepend the context if the reference is relative', function() {
      var ref = '#/definitions/foo_prop';
      var context = '/fixtures/foo';

      expect(this.resolver._normalizeReference(ref, context)).to.equal('/fixtures/foo#/definitions/foo_prop');
    });

    it('should resolve the same fully qualified reference if the reference is already referring to the context', function() {
      var ref = '/fixtures/foo#/definitions/foo_prop';
      var context = '/fixtures/foo';

      expect(this.resolver._normalizeReference(ref, context)).to.equal(ref);
    });

    it('should ignore the context if the reference is fully qualified to a different context', function() {
      var ref = '/fixtures/baz#/definitions/baz_prop';
      var context = '/fixtures/foo';

      expect(this.resolver._normalizeReference(ref, context)).to.equal(ref);
    });
  });

  describe('#_resolvePointer', function() {
    it('should resolve the reference for a relative URI with proper context', function() {
      expect(this.resolver._resolvePointer('#/definitions/foo_prop', '/fixtures/foo'))
        .to.be.an('object')
        .that.has.keys(['type', 'description', 'example']);
    });

    it('should resolve a fully qualified internal reference without context', function() {
      expect(this.resolver._resolvePointer('/fixtures/foo#/definitions/foo_prop'))
        .to.be.an('object')
        .that.has.keys(['type', 'description', 'example']);
    });

    it('should resolve a fully qualified reference without context', function() {
      expect(this.resolver._resolvePointer('/fixtures/foo'))
        .to.be.an('object')
        .that.contains.keys(['id', 'definitions', 'properties']);
    });

    it('should resolve a fully qualified reference regardless of context', function() {
      expect(this.resolver._resolvePointer('/fixtures/foo', '/fixtures/baz').id).to.equal('/fixtures/foo');
    });

    it('should throw an error if the schema cannot be found', function() {
      expect(_.bindKey(this.resolver, '_resolvePointer', '/not/a/reference'), 'no context').to.throw(ReferenceError);
      expect(_.bindKey(this.resolver, '_resolvePointer', '/not/a/reference', '/fixtures/foo'), 'with valid context').to.throw(ReferenceError);
      expect(_.bindKey(this.resolver, '_resolvePointer', '/not/a/reference', '/fake/foo'), 'with invalid context').to.throw(ReferenceError);
      expect(_.bindKey(this.resolver, '_resolvePointer', '#/not/a/place', '/fixtures/foo'), 'with invalid relative internal reference').to.throw(ReferenceError);
      expect(_.bindKey(this.resolver, '_resolvePointer', '/fixtures/foo#/not/a/place', '/fixtures/foo'), 'with invalid fully qualified internal reference').to.throw(ReferenceError);
    });
  });

  describe('#get', function() {
    it('should resolve a fully qualified reference', function() {
      expect(this.resolver.get('/fixtures/foo'))
        .to.be.an('object')
        .that.contains.keys(['id', 'definitions', 'properties']);
    });

    it('should resolve a fully qualified internal reference', function() {
      expect(this.resolver.get('/fixtures/foo#/definitions/foo_prop'))
        .to.be.an('object')
        .that.has.keys(['type', 'description', 'example']);
    });
  });

  describe('#addSchema', function() {
    it('should add the schema to the store', function() {
      this.resolver.addSchema({
        id: '/my/schema',
        type: 'object'
      });

      expect(this.resolver.schemas).to.contain.key('/my/schema');
    });
  });

  describe('#removeSchema', function() {
    it('should remove the schema by ID from the store', function() {
      this.resolver.removeSchema('/fixtures/foo');
      expect(this.resolver.schemas).to.not.contain.key('/fixtures/foo');
    });

    it('should remove the schema by reference from the store', function() {
      this.resolver.removeSchema(this.resolver.schemas['/fixtures/foo']);
      expect(this.resolver.schemas).to.not.contain.key('/fixtures/foo');
    });
  });

  describe('#dereferenceSchema', function() {
    it('should replace $ref references with the resolved schema', function() {
      expect(this.schema1.properties.foo, 'properties, definition reference').to.have.key('$ref');
      expect(this.schema1.properties.baz, 'properties, definition reference (external ref)').to.have.key('$ref');
      expect(this.schema1.definitions.baz_prop, 'definitions, external reference').to.have.key('$ref');
      expect(this.schema1.links[0].schema.properties.foo, 'deep object in array').to.have.key('$ref');
      expect(this.schema1.properties.boo.oneOf[0], '$ref object in array').to.have.key('$ref');

      var schema = this.resolver.dereferenceSchema(this.schema1, this.schema1.id);
      expect(schema.properties.foo, 'properties, definition reference').to.not.have.key('$ref');
      expect(schema.properties.baz, 'properties, definition reference (external ref)').to.not.have.key('$ref');
      expect(schema.definitions.baz_prop, 'definitions, external reference').to.not.have.key('$ref');
      expect(schema.links[0].schema.properties.foo, 'deep object in array').to.not.have.key('$ref');
      expect(schema.properties.boo.oneOf[0], '$ref object in array').to.not.have.key('$ref');
    });
  });
});
