// JSON-Schema documentation generator
// ===================================
// Base components for creating HTML documentation
'use strict';

module.exports = {
  Composer: require('./lib/composer'),
  SchemaDriver: require('./drivers/schema'),
  SchemaTransformer: require('./lib/transformer'),
  TemplateDriver: require('./drivers/template')
};
