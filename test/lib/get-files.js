'use strict';
/* globals: describe, it */

var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var getFiles = require('../../lib/get-files');
var fixturesDir = process.cwd() + '/test/fixtures';

chai.use(require('sinon-chai'));

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

  describe('#asObjects', function() {
    it('should return a mapped object of JSON contents, keyed by file name', function() {
      return getFiles.asObjects([fixturesDir + '/schema1.json', fixturesDir + '/schema2.json']).then(function(map) {
        expect(map).to.be.an('object');
        expect(map).to.have.property(fixturesDir + '/schema1.json').that.is.an('object');
        expect(map).to.have.property(fixturesDir + '/schema2.json').that.is.an('object');
      });
    });

    it('should allow to specify a custom parser, keyed by file name', function() {
      var cb = sinon.spy(JSON.parse);
      return getFiles.asObjects([fixturesDir + '/schema1.json', fixturesDir + '/schema2.json'], cb).then(function(map) {
        expect(map).to.be.an('object');
        expect(map).to.have.property(fixturesDir + '/schema1.json').that.is.an('object');
        expect(map).to.have.property(fixturesDir + '/schema2.json').that.is.an('object');
        expect(cb).to.have.been.calledTwice;
        expect(cb).to.have.been.calledWithMatch(sinon.match.string, fixturesDir + '/schema1.json');
        expect(cb).to.have.been.calledWithMatch(sinon.match.string, fixturesDir + '/schema2.json');
      });
    });
  });
});
