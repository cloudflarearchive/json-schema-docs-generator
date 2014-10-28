// Schema resolver
// ===============
// Recursively resolves references from an array of schemas.
'use strict';

var _ = require('lodash'),
	pointer = require('./pointer'),
	colors = require('colors'),
	deep = require('deep-get-set');

// Required options:
// - `schemas` : An array of schema objects to recurse through and resolve
// Optional:
// - `flags` : runtime flags
module.exports = function (options) {
	// Our lookup reference for other schemas
	var schemas = options.schemas;
	var flags = options.flags;

	// The heavy lifter. This is a recursive method that will traverse over each key in
	// the given `schema` and resolve the values until there are no $ref occurrences left.
	//
	// @param context string [required] - schema ID that in the current resolving context
	// @param schema object [required] - a valid JSON schema object
	// @param prop string [optional] - Used in a recursive context, specifically when a `$ref` is found and the result of the `$ref` needs to be assigned to the original property
	// @param stack object [optional] - The parent object that contains the above `prop` when in the `$ref` context, so we can assign the result to the parent.
	var resolveSchema = function (context, schema, prop, stack) {
		// If the value is not an object, we've reach the end of the line, so just
		// return the value;
		if (!_.isPlainObject(schema)) { return schema; }

		// Loop through the object and recursively resolve each value
		_.each(schema, function(val, property){
			// Found a sub-schema
			if (property === '$ref') {
				debug(3, 'Found $ref: %s in %s - Resolving...', val, context);
				// Resolve schema or definition reference
				var resolved = resolvePointer(val, context);
				// If we couldn't find the schema
				if (!resolved) {
					throw new ReferenceError('Could not find '+val+' from loaded schemas (Referenced from: '+context+')');
				}
				// Assign the resolved reference as the schema for this prop/stack loop.
				// Pass along the resolved ID if it's a valid schema, to
				// force a context change when recursing
				schema = resolveSchema(normalizeReference(val, context), resolved, prop, stack);
				// Quit this loop once we've found a `$ref`
				return false;
			}

			// Standard object, recurse down through
			if (_.isPlainObject(val)) {
				resolveSchema(context, val, property, schema);
			}

			// This will occur in `allOf`, `oneOf`, `anyOf` contexts, where
			// there are an array of schemas
			if (_.isArray(val)) {
				debug(3, 'Found "%s" in %s with %d items - Resolving...', property, schema.id || context, val.length);
				return val.forEach(function(s, idx){
					resolveSchema(context, s, idx, val);
				});
			}
		});

		// If we're resolving a property in a stack, assign the resulting schema
		// in the property location. This important when looping through nested
		// $refs and when iterating over arrays
		if (stack && !_.isUndefined(prop)) {
			debug(3, 'Assigning "%s" to resolved schema: %s', prop, schema.id || schema.title || 'No identifier')
			stack[prop] = schema;
		}

		return schema;
	};

	// Always return a full reference, including root schema ID
	// with any relative pointer appended
	//
	// @param uri string - pointer reference to a property or schema
	// @param context string - current schema ID requesting reference
	var normalizeReference = function (uri, context) {
		var uriComponents = uri.split('#'),
			contextComponents = context ? context.split('#') : [],
			schemaID = uriComponents[0],
			contextID = contextComponents[0],
			// Look up the schema to use.
			resolvedSchema = schemaID.length ? schemas[schemaID] : schemas[contextID];

		if (!resolvedSchema) {
			throw new ReferenceError('Bad URI: '+uri.red+' (in: '+contextID.yellow+')');
		}

		return resolvedSchema.id+(uriComponents[1] ? '#'+uriComponents[1] : '');
	}

	// Look up a reference based on a given URI. `context` will be used as the schema
	// if the URI is relative (i.e., starts with #)
	//
	// @param uri string - pointer reference to a schema or property
	// @param context string - The current schema ID that's requesting the reference (used when the context is relative, `#/definitions/example`)
	var resolvePointer = function(uri, context) {
		// Resolve the URI so a schema ID is always included
		uri = normalizeReference(uri, context);

		var pieces = uri.split('#'),
			schema = schemas[pieces[0]],
			reference;

		if (!schema) {
			throw new ReferenceError('Schema not found: '+ uri.red);
		}

		if (pieces[1]) {
			reference = pointer.get(schema, pieces[1]);
		} else {
			// If there is no deep reference, just return the whole schema
			reference = schema;
		}

		if (reference) {
			debug(2, 'Resolved reference: %s', uri.green);
		} else {
			throw new ReferenceError('Bad reference from '+context+': '+uri.red);
		}

		return reference;
	};

	// Debugging mode
	//
	// @return void
	var debug = function (level) {
		var args = [].slice.call(arguments, 1);
		if (flags.debug && level <= flags.debug ) {
			args[0] = 'RESOLVER: '+args[0];
			console.log.apply(console.log, args);
		}
	}

	// Traverse each schema and resolve all references.
	//
	// @return array - of fully resolve schemas
	this.resolve = function () {
		return _.map(schemas, function(schema, id){
			return resolveSchema(id, schema);
		});
	};

	// Get a property or schema by pointer reference
	//
	// @param uri string - pointer reference to a schema or property
	// @return object
	this.get = function (uri) {
		return resolvePointer(uri);
	}

	// Add a schema to the list
	//
	// @param schema object
	// @return Resolver
	this.addSchema = function (schema) {
		schemas[schema.id] = schema;
		return this;
	}

	// Remove a schema from the list
	//
	// @param schema object
	// @return Resolver
	this.removeSchema = function (schema) {
		delete schemas[schema.id || schema];
		return this;
	}
}
