'use strict';
/* globals: describe, it */

var expect = require('chai').expect;
var Parser = require('../../lib/parser');
var fixturesDir = process.cwd() + '/test/fixtures';

/** @name describe @function */
/** @name it @function */
/** @name before @function */
/** @name after @function */
/** @name beforeEach @function */
/** @name afterEach @function */

describe('Schema Parser', function() {
  beforeEach(function() {
    this.parser = new Parser([fixturesDir + '/*.json']);
  });

  it('should return an object', function() {
    return this.parser.run().then(function(result) {
      expect(result).to.be.an('object');
    });
  });

  it('should key schemas by ID', function() {
    return this.parser.run().then(function(result) {
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

  it('should not resolve excluded schemas', function() {
    this.parser = new Parser([fixturesDir + '/*.json'], [fixturesDir + '/schema3.json']);

    return this.parser.run().then(function(result) {
      expect(result).to.not.have.keys(['/do/not/include']);
    });
  });
});
