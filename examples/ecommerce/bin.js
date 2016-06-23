#!/usr/bin/env node

var start = new Date();
var minimist = require('minimist');
var args = minimist(process.argv.slice(2));
var debug = parseInt(args.debug, 0); // Pass in debug level via cli --debug=[1-4]
var Docs = require('json-schema-docs-generator');
var schemaDriver = new Docs.SchemaDriver(['schemas/**/*.json'], undefined, {
  debugLevel: debug
});
var templateDriver = new Docs.TemplateDriver(['templates/*.handlebars'], {
  debugLevel: debug
});
var composer = new Docs.Composer(schemaDriver, templateDriver, {
  destination: 'dist',
  pages: [{
    file: 'index.html',
    title: 'Sample E-Commerce API Documentation',
    sections: [{
      title: 'Products and your cart',
      schemas: [
        '/cart-item',
        '/product'
      ]
    }]
  }],
  curl: {
    baseUrl: 'https://www.example.com/api/v1',
    requestHeaders: {
      'Authorization': 'Bearer c2547eb745079dac9320b638f5e225cf483cc5cfdda41',
      'Content-Type': 'application/json'
    }
  }
});

composer.addTransform(Docs.SchemaTransformer);
composer.build()
  .bind(composer)
  .then(composer.write)
  .then(function() {
    var end = new Date();
    global.console.log('Build time: %s seconds', (end.getTime() - start.getTime())/1000);
  })
  .catch(function(err) {
    global.console.log(err.message);
    global.console.log(err.stack);
  });
