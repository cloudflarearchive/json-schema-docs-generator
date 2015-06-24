'use strict';
/* globals: describe, it */

var expect = require('chai').expect;
var getFiles = require('../../lib/get-files');
var fixturesDir = process.cwd() + '/test/fixtures';

/** @name describe @function */
/** @name it @function */
/** @name before @function */
/** @name after @function */
/** @name beforeEach @function */
/** @name afterEach @function */

describe('Get files', function() {
  describe('#raw', function() {
    it('should return a mapped object of file contents, keyed by file name', function() {
      return getFiles.raw([fixturesDir + '/schema1.json', fixturesDir + '/schema2.json']).then(function(map) {
        expect(map).to.be.an('object');
        expect(map).to.have.property(fixturesDir + '/schema1.json').that.is.a('string');
        expect(map).to.have.property(fixturesDir + '/schema2.json').that.is.a('string');
      });
    });
  });

  describe('#asJSON', function() {
    it('should return a mapped object of JSON contents, keyed by file name', function() {
      return getFiles.asJSON([fixturesDir + '/schema1.json', fixturesDir + '/schema2.json']).then(function(map) {
        expect(map).to.be.an('object');
        expect(map).to.have.property(fixturesDir + '/schema1.json').that.is.an('object');
        expect(map).to.have.property(fixturesDir + '/schema2.json').that.is.an('object');
      });
    });
  });
});
