'use strict';

var _ = require('lodash'),
	fs = require('fs'),
	Promise = require('bluebird'),
	getFiles = require('./lib/get-files'),
	SchemaResolver = require('./lib/resolver'),
	path = require('path'),
	endpointOptionDefaults = {
		attributes : ['title', 'description', 'method'],
		attribtueParameters : ['name', 'type', 'description', 'example'],
		typeEnum : 'enum',
		curlHeaders : []
	},
	// constructor
	Generator = function( options ){
		// Base URL used with example cURLs
		this.apiURL = options.apiURL;
		// Globs of file paths we should fetch
		this.schemas = options.schemas;
		// File paths we shouldn't parse.
		this.dontParse = options.dontParse || [];
		// Schemas that shouldn't have docs. Useful
		// for base objects that others extend from,
		// but have no use for documentation
		this.noDocs = options.noDocs || [];
		// Globs of template files
		this.templates = options.templates || [];
		// Pages to build, referenced by template name
		this.pages = options.pages;
		// The compiler to use (e.g., Handlebars.compile)
		this.compiler = options.compiler;
		// Each endpoint section will get these parameters
		// for the template
		this.endpointOptions = _.defaults({}, options.endpointOptions, endpointOptionDefaults);
		// Default curl command format.
		this.curl = options.curl || '$ curl -X';

		// Internal items
		// --------------
		// Maps of schemaID => schema
		this.schemasByID = {};
		// Maps of templateFileName => contents
		this.templateMap = {};
	},
	base = {};

module.exports = Generator;
Generator.prototype = base;

_.extend(base, {

	// Resolve schemas and template globs
	resolvePaths : function () {
		return Promise.all([this.resolveSchemas(), this.resolveTemplates()]);
	},

	// Get schemas contents and resolve references
	resolveSchemas : function () {
		return new Promise(function (resolve, reject) {
			// Get only the files we want to parse
			var files = this.schemas.filter(function(path){
				return !_.include(this.dontParse, path);
			}.bind(this));

			getFiles.asJSON(files).bind(this).then(function(files){
				// Only store schemas that should have docs
				_.each(files, function(schema){
					this.schemasByID[schema.id] = schema;
				}, this);

				// Pass back schema map..
				this.resolver = new SchemaResolver({schemas: this.schemasByID});
				resolve(this.schemasByID, this.resolver);
				return this.schemasByID;

			});
		}.bind(this));
	},

	// Get the contents of each template file, and key the results by file name.
	// (useful for nesting templates / including (named) partials)
	resolveTemplates : function () {
		return new Promise(function (resolve, reject) {
			getFiles.raw(this.templates).bind(this).then(function (templates) {
				// Map file name to contents
				_.reduce(templates, function (acc, contents, p) {
					acc[path.basename(p, path.extname(p))] = contents;
					return acc;
				}, this.templateMap, this);

				resolve(this.templateMap);
				return this.templateMap;
			});
		}.bind(this));
	},

	// Run the contents of each template through
	// the provided compiler
	compileTemplates : function (Compiler) {
		_.each(this.templateMap, function (t, id) {
			this.templateMap[id] = Compiler(t);
		}.bind(this));
		return this.templateMap;
	},

	// Build the objects needed for the template and
	// create the configured HTML files
	makeHTML : function () {
		var sections = this.buildSchemaDocObjects(this.resolver.resolve());
		return _.reduce(this.pages, function(acc, includeSchemas, page){
			// Temporary
			var template = this.templateMap[page] || this.templateMap.index;
			acc[page] = template({
				sections: this.getSectionsForPage(sections, includeSchemas)
			});
			return acc;
		}, {}, this);
	},

	// Each page can have an array of schema IDs that should
	// be included with it.
	getSectionsForPage : function (sections, include) {
		// Special case for all schemas on one page
		if (include === '*') {return sections;}

		return _.filter(sections, function (section) {
			return _.contains(include, section._id);
		});
	},

	// Expects to resolve a relative URI from the given schema ID
	resolveURI : function(href, id, replaceWithData) {
		// This will pull out all {/schema/pointers}
		var pat = /((?:{(?:#?(\/[\w\/]+))})+)+/g,
			matches = href.match(pat);

		_.each(matches, function (match) {
			var stripped, definition, replacement;
				// Remove the brackets so we can find the definition
			stripped = match.replace(/[{}]/g, ''),
			definition = this.resolver.get(id+stripped),
			// Replace the match with either example data or the last component of the pointer
			replacement = replaceWithData ? (definition.example || definition.default) : ':'+path.basename(stripped);
			href = href.replace(match, replacement);
		}, this);

		return href;
	},

	// Each schema will contain itself, an HTML-ready ID, and
	// and array of endpoints (schema.links)
	buildSchemaDocObjects : function (schemas) {
		return _.compact(_.map(schemas, function (schema) {
			// Don't generate docs for these items
			if (_.include(this.noDocs, schema.id)) { return false; }

			return _.extend({}, schema, {
				// Save the real ID for mapping
				_id : schema.id,
				// This ID can ba used as the id attribute of the API section
				id : this._sanitizeHTMLAttributeValue(schema.title || ''),
				// An array of endpoints available to the schema
				endpoints : this.buildEndpoints(schema),
				definition : this.buildDefinition(schema, schema.required)
			});
		}, this));
	},

	// Build the endpoint for each link object of the schema
	buildEndpoints : function (schema) {
		return _.map(schema.links, _.bind(this.buildEndpoint, this, schema));
	},

	// Build the object used in the template to represent each
	// endpoint. Provides the URI, HTML-ready ID, required/optional
	// input parameters, example cURL, and example response object
	buildEndpoint : function (schema, link) {
		var options = this.endpointOptions,
			defaults = _.pick(link, options.attributes);

		return _.extend(defaults, {
			id : this._sanitizeHTMLAttributeValue(schema.title+'-'+defaults.title),
			uri : this.resolveURI(link.href, schema.id),
			permissions : link.permissions_required && link.permissions_required.enum ? link.permissions_required.enum.join(', ') : false,
			parameters : this.buildEndpointParameterMap(link),
			curl : this.buildCurl(
				this.resolveURI(link.href, schema.id, true),
				link.method,
				options.curlHeaders,
				this.buildExampleData(schema, link.schema)
			),
			response : JSON.stringify(this.buildExampleData(schema, link.targetSchema), null, 2)
		});
	},

	// Build a map of each property in the schema that can be output
	// in the template in a predictable manner
	buildEndpointParameterMap : function (link) {
		var schema = link.schema || {},
			required = link.required || [],
			map = {required: [], optional: []};

		// !TODO: Support allOf/oneOf/anyOf
		if (schema.properties) {
			_.each(schema.properties, function (config, name) {
				var paramList = (config.required || _.contains(required, name)) ? map.required : map.optional;
				paramList.push( this.buildParameterFields(config, name) );
			}, this);
		}

		return map;
	},

	// Build the actual parameter object. There are a few core defaults,
	// but you can override `getParameterFieldValue` to customize any
	// additional parameters you may want to show
	buildParameterFields : function (config, name) {
		var options = this.endpointOptions,
			parameters = options.attribtueParameters;

		return _.reduce(parameters, function (item, field) {
			switch (field) {
				case 'name':
					item[field] = name;
					break;
				case 'type':
					item[field] = config.enum ? options.typeEnum : config.type;
					break;
				case 'example':
					var useItems = config.items && !config.example,
						obj = useItems ? config.items : config,
						val = obj.hasOwnProperty('example') ? obj.example : obj.default;

					item[field] = JSON.stringify(useItems ? [val] : val);
					break;
				default:
					item[field] = this.getParameterFieldValue(name, config, field);
					break;
			}

			if (config.properties) {
				var map = this.buildEndpointParameterMap({schema : config});
				item.fields = map.required.concat(map.optional);
			}

			return item;
		}, {}, this);
	},

	// Stub method for customizing the attribute parameter output
	getParameterFieldValue : function (attributeName, attributeConfig, field) {
		return attributeConfig[field];
	},

	// Builds a parameter map for a given schema
	buildObjectParameterMap : function (object) {
		var props = this.buildPropsDefinitions(object.properties),
			addtl = this.buildPropsDefinitions(object.additionalProperties);
		return _.extend(props, addtl);
	},

	// Takes an object and build parameter fields for each, returning the
	// configuration keyed by property name
	buildPropsDefinitions : function (props) {
		return _.reduce(props, function (acc, config, name){
			acc[name] = this.buildParameterFields(config, name);
			return acc;
		}, {}, this);
	},

	// Builds an object defintion. Similar to the endpoint parameters,
	// build will detect anyOf/oneOf and return multiple resolved object
	// maps
	buildDefinition : function (schema, required) {
		var def = {properties : {}};

		if (schema.title) {
			def.title = schema.title;
		}

		if (_.isArray(schema)) {
			_.each(schema, function (_schema) {
				def.properties = _.extend(
					def.properties,
					this.buildDefinition(_schema, _schema.required).properties
				);
			}, this);
		} else if (schema.allOf) {
			_.each(schema.allOf, function (_schema) {
				var consumable = this.buildDefinition(_schema, _schema.required);

				if (consumable.objects) {
					consumable = this.buildDefinition(consumable.objects, schema.required);
				}

				def.properties = _.extend(def.properties, consumable.properties);
			}, this);
		} else if (schema.oneOf || schema.anyOf) {
			var items = schema.oneOf || schema.anyOf;
			def.objects = [];
			_.each(items, function (_schema) {
				def.objects.push(this.buildDefinition(_schema, _schema.required));
			}, this);
		} else {
			_.extend(def.properties, this.buildObjectParameterMap(schema));
		}

		return def;
	},

	// Returns a curl formatted string
	buildCurl : function (href, method, headers, data) {
		var url = this.apiURL + href,
			flags = [],
			curl = '';

		_.each(headers, function (v, k) {
			flags.push(this._buildCurlHeader('H', k+': '+v));
		}, this);

		if (data) {
			if ('GET' === method) {
				url += this._buildQueryString(data);
			} else {
				flags.push(this._buildCurlHeader('-data', JSON.stringify(data), '\''));
			}
		}

		curl = [this.curl, method, url].join(' ');
		curl += '\\\n\t\t' + flags.join('\\\n\t\t');

		return curl;
	},

	// A recursive method to pull out example/default properties of
	// the schema's attributes.
	//
	// Attempt to build an example data object from a given schema.
	// This is used primarily for resolving targetSchemas from Link Objects.
	// These are typically nested API response objects where we
	// need to build the response object and splice in example data for the
	// root-level schema (i.e., domain object)
	buildExampleData : function (root, schema, options) {
		options = options || {};
		var reduced = {};

		// Just bail out if we haven't received a schema
		if (!schema) {return null;}

		// Array of schemas might be from an allOf directive
		// so we merge them together, with the latter overwriting
		// the former.
		if (_.isArray(schema)) {
			schema.forEach(function (subschema) {
				reduced = _.extend(reduced, this.buildExampleData(root, subschema, options));
			}.bind(this));
		// Merge schemas together
		} else if (schema.allOf) {
			reduced = this.buildExampleData(root, schema.allOf, options)
		} else if (schema.oneOf || schema.anyOf) {
			var subschema = schema.oneOf || schema.anyOf;
			// Pass in the index for the oneOf/anyOf to choose one
			// of the schemas to build example data for
			reduced = this.buildExampleData(root, subschema[options.oneOfIndex || options.anyOfIndex || 0], options)
		// If the schema is a reference to itself, build the example data
		// based on the root schema
		} else if(schema.rel === 'self') {
			reduced = this.buildExampleData(root, root, options);
		// Finally, if we've found properties, map the example data
		} else if (schema.properties) {
			reduced = this.buildExampleProperties(root, schema.properties);
		}

		return reduced;
	},

	// Pull example data from an attribute configuration object of a schema.
	// Delegates back to #buildExampleData if it encounters a full schema for
	// a property definition
	buildExampleProperties : function (root, properties) {
		return _.reduce(properties, function (props, config, name) {
			// Ignore any note properties (__notes)
			if (name.indexOf('__') === 0) {return props;}

			var example = config.example || config.default;

			// If the property is referencing a defintion, we
			// have to dig a level deeper for the example data
			if (_.isPlainObject(example) && (example.example || example.default)) {
				example = example.example || example.default;
			// Resolve `items` from an array definition
			} else if (config.type === 'array' && config.items && !example) {
				example = [config.items.example || this.buildExampleData(root, config.items)];
			// The property definition is referencing a schema
			// and we don't already have an example
			} else if (config.id && !example) {
				example = this.buildExampleData(root, config);
			// Nest objects
			} else if (config.properties) {
				example = this.buildExampleProperties(root, config.properties);
			}
			// Forcing all keys to lowercase. This is done partially because
			// the parser gets confused when declaring "id" as a property of an object,
			// because it wants to resolve it as reference to another schema.
			// The current solution is to declare ids as "ID" for the data object in the schema
			// See: http://json-schema.org/latest/json-schema-core.html#anchor27
			props[name.toLowerCase()] = example;
			return props;
		}, {}, this);
	},

	// Helpers
	// -------

	_buildCurlHeader : function (flag, val, quoteType) {
		quoteType = quoteType || '"';
		return ['-', flag, ' ', quoteType, val, quoteType].join('');
	},

	_sanitizeHTMLAttributeValue : function (val) {
		return val.toString().toLowerCase().replace(/[\s.,;'=<>\/]+/gi, '-');
	},

	_buildQueryString : function (obj, noQ) {
		var firstJoin = noQ ? '&' : '?';
		return _.reduce(obj, function (str, val, key) {
			var conn = (str === firstJoin) ? '' : '&';
			return str + conn + key + '='+ val;
		}, firstJoin);
	}
});

