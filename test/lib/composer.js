'use strict';
/* globals: describe, it */

var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var schema1 = require('../fixtures/schema1.json');
var schema2 = require('../fixtures/schema2.json');
var SchemaDriver = require('../../drivers/schema');
var TemplateDriver = require('../../drivers/template');
var Composer = require('../../lib/composer');
var Promise = require('bluebird');
var fixturesDir = process.cwd() + '/test/fixtures';
var _ = require('lodash');

chai.use(require('sinon-chai'));

/** @name describe @function */
/** @name it @function */
/** @name before @function */
/** @name after @function */
/** @name beforeEach @function */
/** @name afterEach @function */

describe('Composer', function() {
  // @TODO Figure out a better way isolate these tests
  before(function() {
    this.schema1 = _.cloneDeep(schema1);
    this.schema2 = _.cloneDeep(schema2);
    this.schemas = [this.schema1, this.schema2];
  });

  beforeEach(function() {
    this.schemaDriver = new SchemaDriver(this.schemas);
    this.templateDriver = new TemplateDriver([fixturesDir + '/*.handlebars']);
    this.sandbox = sinon.sandbox.create();
    this.composer = new Composer(this.schemaDriver, this.templateDriver, {
      pages: [{
        file: 'index.html',
        title: 'Page 1',
        description: 'Some description',
        sections: [{
          title: 'Section 1',
          schemas: ['/fixtures/foo']
        }, {
          title: 'Section 2',
          schemas: ['/fixtures/baz']
        }]
      }]
    });
    this.keyedSchemas = {
      '/fixtures/foo': this.schema1,
      '/fixtures/baz': this.schema2
    };
    this.resolvedTemplates = {
      base: function(data) {
        return JSON.stringify(data);
      }
    };
  });

  afterEach(function() {
    this.sandbox.reset();
  });

  describe('#constructor', function() {
    it('should throw an error if pages are not provided', function() {
      expect(function() {
        return new Composer();
      }).to.throw(TypeError);
    });
  });

  describe('#build', function() {
    it('should build schemas and templates on build', function() {
      this.sandbox.stub(this.composer, 'buildSchemas', function() {});
      this.sandbox.stub(this.composer, 'buildTemplates', function() {});
      this.sandbox.stub(this.composer, 'compose', function() {});

      return this.composer.build().then(_.bind(function() {
        expect(this.composer.buildSchemas).to.have.been.calledOnce;
        expect(this.composer.buildTemplates).to.have.been.calledOnce;
      }, this));
    });

    it('should not call compose if building schemas fails', function() {
      this.sandbox.stub(this.composer, 'buildSchemas', function() {
        return Promise.reject('error!');
      });
      this.sandbox.stub(this.composer, 'buildTemplates', function() {
        return Promise.resolve(true);
      });
      this.sandbox.stub(this.composer, 'compose', function() {});

      return this.composer.build().catch(_.bind(function() {
        expect(this.composer.compose).to.not.have.been.called;
      }, this));
    });

    it('should not call compose if building templates fails', function() {
      this.sandbox.stub(this.composer, 'buildSchemas', function() {
        return Promise.resolve(true);
      });
      this.sandbox.stub(this.composer, 'buildTemplates', function() {
        return Promise.reject('error!');
      });
      this.sandbox.stub(this.composer, 'compose', function() {});

      return this.composer.build().catch(_.bind(function() {
        expect(this.composer.compose).to.not.have.been.called;
      }, this));
    });

    it('should call compose when building schemas and templats finishes', function() {
      this.sandbox.stub(this.composer, 'buildSchemas', function() {
        return Promise.resolve(true);
      });
      this.sandbox.stub(this.composer, 'buildTemplates', function() {
        return Promise.resolve(true);
      });
      this.sandbox.stub(this.composer, 'compose', function() {});

      return this.composer.build().catch(_.bind(function() {
        expect(this.composer.compose).to.have.been.calledOnce;
      }, this));
    });
  });

  describe('#buildSchemas', function() {
    it('should call fetch on the schem driver', function() {
      this.sandbox.stub(this.schemaDriver, 'fetch', function() {
        return Promise.resolve({});
      });
      this.composer.buildSchemas();

      expect(this.schemaDriver.fetch).to.have.been.calledOnce;
    });

    it('should apply transforms after the schema driver is finished', function() {
      this.sandbox.stub(this.schemaDriver, 'fetch', function() {
        return Promise.resolve({});
      });
      this.sandbox.stub(this.composer, 'applyTransforms');

      return this.composer.buildSchemas().then(_.bind(function() {
        expect(this.composer.applyTransforms).to.have.been.calledOnce;
      }, this));
    });
  });

  describe('#buildTemplates', function() {
    it('should call fetch on the template driver', function() {
      this.sandbox.stub(this.templateDriver, 'fetch', function() {
        return Promise.resolve({});
      });
      this.composer.buildTemplates();

      expect(this.templateDriver.fetch).to.have.been.calledOnce;
    });
  });

  describe('#addTransform', function() {
    it('should add the transform to the array', function() {
      expect(this.composer.transforms).to.have.length(0);
      this.composer.addTransform(function(){});
      expect(this.composer.transforms).to.have.length(1);
    });
  });

  describe('#applyTransforms', function() {
    beforeEach(function() {
      var transformer = function(schemas) {
        this.transform = function() {
          schemas.transformed = true;
          schemas['/fixtures/foo'].myNewProperty = 1;
          return schemas;
        };
      };
      this.composer.addTransform(transformer);
      this.transformed = this.composer.applyTransforms({
        '/fixtures/foo': this.schema1,
        '/fixtires/baz': this.schema2
      });
    });

    it('should return an object', function() {
      expect(this.transformed).to.be.an('object')
    });

    it('should be transformed', function() {
      expect(this.transformed).to.have.property('transformed').that.is.true;
      expect(this.transformed['/fixtures/foo']).to.have.property('myNewProperty').that.equals(1);
    });
  });

  describe('#compose', function() {
    beforeEach(function() {
      this.composed = this.composer.compose(this.keyedSchemas, this.resolvedTemplates);
    });

    it('should return an object', function() {
      expect(this.composed).to.be.an('object');
    });

    it('should have file names/paths as the keys', function() {
      expect(this.composed).to.have.property('index.html');
    });

    it('should contain the template contents', function() {
      expect(this.composed['index.html']).be.a('string');
    });
  });

  describe('#composePage', function() {
    it('should call getPageTemplateData to get template data', function() {
      this.sandbox.spy(this.composer, 'getPageTemplateData');
      this.composer.composePage(this.composer.options.pages[0], this.keyedSchemas, this.resolvedTemplates);

      expect(this.composer.getPageTemplateData).to.have.been.calledOnce;
    });

    it('should call the "base" template method', function() {
      this.sandbox.spy(this.resolvedTemplates, 'base');
      this.composer.composePage(this.composer.options.pages[0], this.keyedSchemas, this.resolvedTemplates);

      expect(this.resolvedTemplates.base).to.have.been.calledOnce;
    });
  });

  describe('#getPageTemplateData', function() {
    it('should return page and navigation attributes for template data', function() {
      var data = this.composer.getPageTemplateData(this.composer.options.pages[0], this.keyedSchemas, this.resolvedTemplates);

      expect(data).to.deep.equal({
        page: this.composer.options.pages[0],
        navigation: {
          currentPage: this.composer.options.pages[0],
          allPages: this.composer.options.pages
        }
      });
    });
  });
});
