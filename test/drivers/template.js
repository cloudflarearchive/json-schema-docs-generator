'use strict';
/* globals: describe, it, beforeEach */

var _ = require('lodash');
var expect = require('chai').expect;
var TemplateDriver = require('../../drivers/template');
var fixturesDir = process.cwd() + '/test/fixtures';

/** @name describe @function */
/** @name it @function */
/** @name before @function */
/** @name after @function */
/** @name beforeEach @function */
/** @name afterEach @function */

describe('Template Driver', function() {
  beforeEach(function() {
    this.driver = new TemplateDriver([fixturesDir + '/*.handlebars']);
  });

  it('should return an object', function() {
    return this.driver.fetch().then(function(result) {
      expect(result).to.be.an('object');
    });
  });

  it('should expand globs to file paths', function() {
    return this.driver.fetch().then(function(result) {
      expect(_.keys(result)).to.have.length(3);
    });
  });

  it('should key templates by filename', function() {
    return this.driver.fetch().then(function(result) {
      expect(result).to.have.keys(['template1', 'template2', 'template3']);
    });
  });

  it('should compile files to pre-compiled templates', function() {
    return this.driver.fetch().then(function(result) {
      _.each(result, function(func) {
        expect(func).to.be.a('function');
      });
    });
  });
});
