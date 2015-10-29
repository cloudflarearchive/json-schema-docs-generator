'use strict';
/* globals: describe, it */

var expect = require('chai').expect;
var resolveGlobs = require('../../../lib/helpers/resolve-globs');
var testGlob = process.cwd() + '/test/fixtures/*';

/** @name describe @function */
/** @name it @function */
/** @name before @function */
/** @name after @function */
/** @name beforeEach @function */
/** @name afterEach @function */

describe('Resolve Globs', function() {
  it('should return an array of files', function() {
    return resolveGlobs([testGlob]).then(function(result) {
      expect(result).to.be.an('array');
      expect(result).to.have.length.above(0);
    });
  });
});
