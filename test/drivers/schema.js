'use strict';
/* globals: describe, it, beforeEach */

var _ = require('lodash');
var expect = require('chai').expect;
var SchemaDriver = require('../../drivers/schema');
var fixturesDir = process.cwd() + '/test/fixtures';

/** @name describe @function */
/** @name it @function */
/** @name before @function */
/** @name after @function */
/** @name beforeEach @function */
/** @name afterEach @function */

describe('Schema Driver', function() {
  beforeEach(function() {
    this.driver = new SchemaDriver([fixturesDir + '/*.json']);
  });

  it('should return an object', function() {
    return this.driver.fetch().then(function(result) {
      expect(result).to.be.an('object');
    });
  });

  it('should key schemas by ID', function() {
    return this.driver.fetch().then(function(result) {
      expect(result).to.have.keys([
        '/fixtures/foo',
        '/fixtures/baz',
        '/do/not/include',
        '/recursive/pagerules',
        '/recursive/one',
        '/recursive/two'
        ]);
    });
  });
});
