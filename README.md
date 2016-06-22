JSON Schema HTML Documentation Generator
=========================================
A flexible solution for auto-generating HTML API documentation from JSON-schemas that take advantage of the v4 Hyper-Schema definition. To use this package, you must have at least one valid JSON-schema file, preferably one that implements the `links` definition of the Hyper-Schema spec.

[![Travis build status](http://img.shields.io/travis/cloudflare/json-schema-docs-generator.svg?style=flat)](https://travis-ci.org/cloudflare/json-schema-docs-generator)
[![Code Climate](https://codeclimate.com/github/cloudflare/json-schema-docs-generator/badges/gpa.svg)](https://codeclimate.com/github/cloudflare/json-schema-docs-generator)
[![Test Coverage](https://codeclimate.com/github/cloudflare/json-schema-docs-generator/badges/coverage.svg)](https://codeclimate.com/github/cloudflare/json-schema-docs-generator.)
[![Dependency Status](https://david-dm.org/cloudflare/json-schema-docs-generator.svg)](https://david-dm.org/cloudflare/json-schema-docs-generator)
[![devDependency Status](https://david-dm.org/cloudflare/json-schema-docs-generator/dev-status.svg)](https://david-dm.org/cloudflare/json-schema-docs-generator#info=devDependencies)

## What this package provides ##
Four main components are provided that can be combined to generate documented. Each of the components can be configued with a `debugLevel` of 0-4. The higher the debug level, the more verbose the output. This can help with debugging, specifically with resolving schemas.

### Build example

Build the [ecommerce example](https://github.com/cloudflare/json-schema-docs-generator/tree/master/examples/ecommerce) to see how [schemas](https://github.com/cloudflare/json-schema-docs-generator/tree/master/examples/ecommerce/schemas) and [templates](https://github.com/cloudflare/json-schema-docs-generator/tree/master/examples/ecommerce/templates) are combined together:

```
git clone git@github.com:cloudflare/json-schema-docs-generator.git
cd json-schema-docs-generator/examples/ecommerce
npm install
node bin.js
open dist/index.html
```

### Template Driver
The provided template driver uses Handlebars to retrieve, compile, and register partial templates for the generating of documentation. To use your own template engine, simply adhere to the following interface:

The class implements a single method, `fetch`, as its interface. `fetch` is expected to return a `Promise` that will resolve with an object of compiled templates, keyed by file name. The included driver takes an array of file paths (or globs) of template files to retreieve and compile in its constructor.

###### Usage: Template Driver
```javascript
var TemplateDriver = require('json-schema-docs-generator').TemplateDriver;
var driver = new TemplateDriver(['source/templates/*.handlebars'], {
 debugLevel: 1
});

driver.fetch().then(dosomething);
```

### Schema Driver
A schema driver takes an array of file paths (or globs) of JSON schema files. It also implements a single `fetch` interface, which is expected to return a `Promise` that will resolve with an object of fully resolved schemas, keyed by schema the schema's `id`.

The heavy lifting is almost exclusively done by the `Parser` and `Resolver` classes, defined in `lib/{parser,resolver}.js`.

###### Usage: Schema Driver
```javascript
var SchemaDriver = require('json-schema-docs-generator').SchemaDriver;
var driver = new SchemaDriver(['schemas/**/*.json'], undefined, {
 debugLevel: 1
});

driver.fetch().then(dosomething);
```

### Composer
A Composer's job is to take templates and schemas, and produce HTML documentation. It will use the `fetch` interface on both drivers, and take the results of each to compose one or more pages that are configured.

The current implementation requirement for the provided Composer class is that the result from the TemplateDriver has a template with the name of `base`. See `Composer.prototype.composePage` for more the implementation details. Ideally a better solution could be found here. The base template will receive a data object with a `page`, containing the object defined by your page configuration. It will also contain `navigation`, which contains a reference to the `currentPage` object, as well as all other page objects under `pages`. The template payload will look something like this:

```javascript
templatesObjectResolvedFromDriver.base({
  page: {
    file: 'index.html',
    title: 'Testing',
    schemas: [{
      .. resolved object ..
    }, {
      .. resolved object ..
    }]
  },
  navigation: {
    currentPage: { .. page object .. },
    allPages: { .. configuration from instantiation .. }
  }
});
```

You can build multiple pages by configuring page objects to group schemas together. Page objects can have any attributes you'd like for your templates. The only thing the Composer will help you do is swap out schema references for the fully resolved/transformed schemas. The composer will look for an array of schema IDs at the top level, or within each object of a `sections` array, for grouping one or more schemas that are related.

###### Usage: Composer
```javascript
var Composer = require('json-schema-docs-generator').Composer;
var composer = new Composer(schemaDriver, templateDriver, {
  destination: 'htdocs',
  pages: [{
    file: 'index.html',
    title: 'Testing',
    sections: [{
      title: 'My schema',
      schemas: [
        '/some/schema'
      ]
    }]
  }]
});
```

### Transformer
`Transformer` objects are geared towards preparing schemas for consumption by a template. Transormers are added via `composer.addTransform(TransformClass)`. The composer will instantiate a Transformer class, provide it the full list of resolved schemas (for cross referencing).

The interface for transformer objects are via a `.transform()` method.  This method should return all of the schemas provided to it on instantiation, with whatever modifications/transformations made by the class.

The provided transformer will do a handful of things to prepare schemas for the template, including providing an `htmlID` for each schema, for permalinks.

Other important transformations that happen are:

##### Object Definitions
Each schema object transformed will have an `objectDefinition` attribute, which as the following structure:

```javascript
{
  allProps: {},
  requiredProps: {},
  optionalProps: {},
  objects: Array,
  example: string,
  _original: Object
}
```

If a schema utilizes `oneOf` or `anyOf` definitions, the sub-objects will be stored under `objects`. From here, each property is recursively defined with an example generated for each level.

##### Links
Links are augmented with the following properties:

```javascript
{
  htmlID: string,
  uri: string,
  curl: string,
  parameters: ObjectDefinition,
  response: string
}
```

- `uri`: A resolved URI from the `href` attribute of the `link`, but simplifies any schema references to just the definition name. e.g., `/some/endpoint/{#/definitions/identifier}` => `/some/endpoint/:identifer`
- `curl`: A generated string containing an example cURL request for the endpoint. This will properly include schema information for all GET/POST/PUT/PATCH/DELETE methods.
- `parameters`: An object definition, as defined above, for the parameters of the link.
- `response`: An example response derived from the `targetSchema` of the `link`.


## How to use ##
This package was built with the intent of being flexible. The process of autogenerating documentation has a lot of pieces, so a single class/configuration was too much of an abstraction to be easy to use.

Instead, the core components provided will hopefully be enough to extend, override, and adjust to meet most needs.

Below is the minimal setup:

```javascript
var Docs = require('json-schema-docs-generator');
var schemaDriver = new Docs.SchemaDriver(['schemas/**/*.json']);
var templateDriver = new Docs.TemplateDriver(['source/templates/**/*.handlebars']);
var composer = new Docs.Composer(schemaDriver, templateDriver, {
  destination: 'htdocs',
  pages: [{
    file: 'index.html',
    title: 'Testing',
    sections: [{
      title: 'User',
      schemas: [
        '/user'
      ]
    }]
  }]
});

composer.addTransform(Docs.SchemaTransformer);
composer.build()
        .bind(composer)
        .then(composer.write)
        .catch(function(err) {
          global.console.log(err.message);
        });
```
