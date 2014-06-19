// Resolve sub schemas
'use strict';

var _ = require('lodash'),
	pointer = require('./pointer'),
	deep = require('deep-get-set');

module.exports = function (options) {
	// Our lookup reference for other schemas
	var schemas = options.schemas;
	// The heavy lifter
	var resolveSchema = function (context, schema, prop, stack) {
		if (!_.isPlainObject(schema)) { return schema; }

		// Loop through the object and recursively resolve each value
		_.each(schema, function(val, property){
			// Sub schema
			if (property === '$ref') {
				var resolved = resolveReference(val, context);

				// If we couldn't find the schema
				if (!resolved) {
					console.error('Could not find '+val+' from loaded schemas (Referenced from: '+context+')');
				}
				// Assign the resolved reference as the schema for this prop/stack loop.
				// Pass along the resolved ID if it's a valid schema, to
				// force a context change when recursing
				schema = resolveSchema(resolved.id || context, resolved, prop, stack);
				return false;
			}

			// Standard object, recurse down through
			if (_.isPlainObject(val)) {
				resolveSchema(context, val, property, schema);
			}

			if (_.isArray(val)) {
				return val.forEach(function(s, idx){
					resolveSchema(context, s, idx, val);
				});
			}
		});

		// If we're resolving a property in a stack, assign the resulting schema
		// in the property location. This important when looping through nested
		// $refs and when iterating over arrays
		if (stack && !_.isUndefined(prop)) {
			stack[prop] = schema;
		}

		return schema;
	};

	// Always return a schema ID with relative path appended
	var normalizeReference = function (uri, context) {
		var components = uri.split('#'),
			schemaID = components[0],
			// Look up the schema to use.
			resolvedSchema = schemaID.length && schemas[schemaID] ? schemas[schemaID] : schemas[context];
		return resolvedSchema.id+(components[1] ? '#'+components[1] : '');
	}

	// Look up a reference based on a given URI. `context` will be used as the schema
	// if the URI is relative (i.e., starts with #)
	var resolveReference = function(uri, context) {
		// Resolve the URI so a schema ID is always included
		uri = normalizeReference(uri, context);

		var pieces = uri.split('#'),
			schema = schemas[pieces[0]];

		if (!schema) {
			return console.error('Schema not found: '+ uri);
		}

		// If there is no deep reference, just return the whole schema
		return pieces[1] ? pointer.get(schema, pieces[1]) : schema;
	};

	this.resolve = function () {
		return _.map(schemas, function(schema, id){
			return resolveSchema(id, schema);
		});
	};

	this.get = function (uri) {
		return resolveReference(uri);
	}

	this.addSchema = function (schema) {
		schemas[schema.id] = schema;
	}

	this.removeSchema = function (schema) {
		delete schemas[schema.id || schema];
	}
}
