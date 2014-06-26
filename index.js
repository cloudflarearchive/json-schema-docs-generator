// JSON-Schema documentation generator
// ===================================
// The core Generator class to take a set of schemas, templates, and options
// and build one or more HTML files.
'use strict';

var _ = require('lodash'),
	fs = require('fs'),
	Promise = require('bluebird'),
	getFiles = require('./lib/get-files'),
	SchemaResolver = require('./lib/resolver'),
	path = require('path'),
	// Default endpoint options. All of these can be overridden
	// via your own configuration
	endpointOptionDefaults = {
		// Attributes to include with each `link` endpoint (these will be in
		// addition so some generated properties of this package)
		attributes : ['title', 'description', 'method'],
		// The attributes to build for each parameter listing of an object
		// definition and `link` schema (e.g., required/optional inputs)
		attribtueParameters : ['name', 'type', 'description', 'example'],
		// Additional cURL headers to include with each example cURL request
		// Useful for authentication, etc
		curlHeaders : {}
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
		// Each endpoint section will get these parameters
		// for the template
		this.endpointOptions = _.defaults({}, options.endpointOptions, endpointOptionDefaults);
		// Additional template parameters for each page.
		// Here might be a good place to configure things like an API version, or any global
		// variables you want accessible inside of your templates
		this.templateOptions = options.templateOptions;
		// Default curl command format.
		this.curl = options.curl || '$ curl -X';
	},
	proto = {};

module.exports = Generator;
Generator.prototype = proto;

_.extend(proto, {

	// Resolve schemas and template globs
	//
	// @return Promise
	resolvePaths : function () {
		return Promise.props({
			schemas: this.parseSchemas(),
			templates: this.parseTemplates()
		});
	},

	// Get schemas contents from the filesystem and resolve references
	//
	// @return Promise
	parseSchemas : function () {
		return new Promise(function (resolve, reject) {
			// Get only the files we want to parse
			var files = this.schemas.filter(function(path){
					return !_.include(this.dontParse, path);
				}.bind(this));

			getFiles.asJSON(files).bind(this).then(function(files){
				// Pass back schema map..
				resolve(_.reduce(files, function(acc, schema){
					acc[schema.id] = schema;
					return acc;
				}, {}, this));
			}, reject);
		}.bind(this));
	},

	// Recursively resolve all references schemas for an array of schemas
	//
	// @param schemas object - Valid schema objects, keyed by schema ID
	// @return array - resolve schema objects
	resolveSchemas : function (schemas) {
		var resolver = this.resolver = new SchemaResolver({schemas: schemas});
		return resolver.resolve();
	},

	// Get the contents of each template file, and key the results by file name.
	// (useful for nesting templates / including (named) partials)
	//
	// @return Promise
	parseTemplates : function () {
		return new Promise(function (resolve, reject) {
			getFiles.raw(this.templates).bind(this).then(function (templates) {
				// Map file name to contents
				resolve(_.reduce(templates, function (acc, contents, p) {
					acc[path.basename(p, path.extname(p))] = contents;
					return acc;
				}, {}, this));
			}, reject);
		}.bind(this));
	},

	// Run the contents of each template through the provided compiler
	//
	// @param Compiler function - a compiler function like Handlebars.compile
	// @param templates object - object of templates keyed by template ID (file basename)
	// @return object - template contents, keyed by file basename
	compileTemplates : function (Compiler, templates) {
		return _.reduce(templates, function (acc, t, id) {
			acc[id] = Compiler(t);
			return acc;
		}, {}, this);
	},

	// Build the objects needed for the template and
	// create the configured HTML files
	//
	// @param templates object - Map of templates, keyed by file name
	// @return object - HTML contents, keyed by page basename
	makeHTML : function (templates, schemas) {
		var sections = this.buildSchemaDocObjects(schemas);

		return _.reduce(this.pages, function(acc, includeSchemas, page){
			var template = templates[page] || templates.index; // Temporary?
			acc[page] = template(_.extend({}, this.templateOptions, {
				sections: this.getSectionsForPage(sections, includeSchemas)
			}));
			return acc;
		}, {}, this);
	},

	// Each page can have an array of schema IDs that should
	// be included with it. This method takes all available sections/schemas
	// and returns only the ones that should be included
	//
	// @param sections array - The prepared sections of documentation. This is a one-to-one correlation with all of the schemas that will have documentation
	// @param include array - Schema IDs whose sections should be returned
	// @return array - array of sections
	getSectionsForPage : function (sections, include) {
		// Special case for all schemas on one page
		if (include === '*') {return sections;}

		return _.filter(sections, function (section) {
			return _.contains(include, section._id);
		});
	},

	// Expects to resolve a relative URI from the given schema ID
	// @todo Allow this to resolve any pointer reference, right now it assumes relative
	//
	// @param href string - `href` from a `link` object
	// @param id string - root schema ID
	// @param replaceWithData boolean - Replace references with example content or not
	// @return string - resolved URI
	resolveURI : function(href, id, replaceWithData) {
		// This will pull out all {/schema/pointers}
		var pat = /((?:{(?:#?(\/[\w\/]+))})+)+/g,
			matches = href.match(pat);

		_.each(matches, function (match) {
			var stripped, definition, replacement;
				// Remove the brackets so we can find the definition
			stripped = match.replace(/[{}]/g, '');
			definition = this.resolver.get(id+stripped);
			// Replace the match with either example data or the last component of the pointer
			replacement = replaceWithData ? (definition.example || definition.default) : ':'+path.basename(stripped);
			href = href.replace(match, replacement);
		}, this);

		return href;
	},

	// Each schema will contain itself, an HTML-ready ID, and
	// and array of endpoints (schema.links)
	//
	// @param schemas array - Array of resolved schema objects
	// @return array - sections used for documentation
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
				// Object definition map. Provides name, type, description, example,
				// etc. for the schema. The definition object has a `title` and `properties` attribute,
				// but may also have an `objects` attribute, which contains an array of
				// definition objects.
				definition : this.buildDefinition(schema)
			});
		}, this));
	},

	// Build the endpoint for each link object of the schema
	//
	// @param schema object - valid schema
	// @return array - endpoint objects for the schema
	buildEndpoints : function (schema) {
		return _.map(schema.links, _.bind(this.buildEndpoint, this, schema));
	},

	// Build the object used in the template to represent each
	// endpoint. Provides the URI, HTML-ready ID, required/optional
	// input parameters, example cURL, and example response object
	//
	// @param schema object - The schema the link is for
	// @param link object - The link object from the schema
	// @return object - An endpoint object
	buildEndpoint : function (schema, link) {
		var options = this.endpointOptions,
			defaults = _.pick(link, options.attributes);

		return _.extend(defaults, {
			id : this._sanitizeHTMLAttributeValue(schema.title+'-'+defaults.title),
			uri : this.resolveURI(link.href, schema.id),
			parameters : this.buildEndpointParameterMap(link),
			curl : this.buildCurl(
				this.resolveURI(link.href, schema.id, true),
				link.method,
				options.curlHeaders,
				this.buildExampleData(schema, link.schema)
			),
			response : this._stringifyData(this.buildExampleData(schema, link.targetSchema), true)
		});
	},

	// Build a map of each property in the schema that can be output
	// in the template in a predictable manner
	//
	// @param link - Link object from a schema
	// @return object - Contains arrays of `required` and `optional` parameters for the endpoint
	buildEndpointParameterMap : function (link) {
		var schema = link.schema || {},
			required = link.required || [],
			map = {required: [], optional: []};

		// !TODO: Support allOf/oneOf/anyOf
		if (schema.properties) {
			_.each(schema.properties, function (definition, name) {
				var paramList = (definition.required === true || _.contains(required, name)) ? map.required : map.optional;
				paramList.push( this.buildParameterFields(definition, name) );
			}, this);
		}

		return map;
	},

	// Build the actual parameter object. There are a few core defaults,
	// but you can override `getParameterFieldValue` to customize any
	// additional parameters you may want to show
	//
	// @param definition object - A attribute definition
	// @param name string - The attribute name
	// @return object - A parameter object
	buildParameterFields : function (definition, name) {
		var options = this.endpointOptions,
			parameters = options.attribtueParameters;

		return _.reduce(parameters, function (item, field) {
			switch (field) {
				case 'name':
					item[field] = name;
					break;
				case 'type':
					item[field] = definition.enum ? (options.typeEnum || typeof definition.enum[0]) : definition.type;
					break;
				case 'example':
					var useItems = definition.items && !definition.example,
						obj = useItems ? definition.items : definition,
						val = obj.hasOwnProperty('example') ? obj.example : obj.default;

					item[field] = this._stringifyData(useItems ? [val] : val);
					break;
				case 'description':
					item[field] = definition.description;

					if (definition.enum) {
						item[field] += '\n ('+definition.enum.join(', ')+')';
					}
					break;
				default:
					item[field] = this.getParameterFieldValue(name, definition, field);
					break;
			}

			// If the attribute definition has its own sub-properties,
			// build them up as `fields` of the attribute
			if (definition.properties) {
				var map = this.buildEndpointParameterMap({schema : definition});
				item.fields = map.required.concat(map.optional);
			}

			return item;
		}, {}, this);
	},

	// Stub method for customizing the attribute parameter output.
	// Override this if fields you want require additional processing
	// Typically this will return a string, but you may return anything you want
	// if your template is ready for it.
	//
	// @param name string - attribute name
	// @param definition object - attribute definition
	// @param field string - key within the defintion to add to the parameter object
	// @return string|mixed
	getParameterFieldValue : function (name, definition, field) {
		return definition[field];
	},

	// Builds a parameter map for a given schema
	// @todo better method name
	//
	// @param object object - schema definition with `properties` and possibly `additionalProperties`
	// @return object - definition object
	buildObjectParameterMap : function (object) {
		var props = this.buildPropsDefinitions(object.properties),
			addtl = this.buildPropsDefinitions(object.additionalProperties);
		return _.extend(props, addtl);
	},

	// Builds an object parameter map containing only required fields for the given object
	//
	// @param object object - An object with `properties`
	// @param required array - Array of required property names
	// @return object - definition object
	buildRequiredObjectParameterMap : function (object, required) {
		var requiredProps = _.filter(object.properties, function(definition, name){
			return _.contains(required, name);
		}, this);

		return this.buildObjectParameterMap(requiredProps);
	},

	// Takes an object and build parameter fields for each, returning the
	// configuration keyed by property name
	//
	// @param props object - properties object to build definitions for
	// @return object - definition object
	buildPropsDefinitions : function (props) {
		return _.reduce(props, function (acc, config, name){
			acc[name] = this.buildParameterFields(config, name);
			return acc;
		}, {}, this);
	},

	// Builds an object defintion. Similar to the endpoint parameters, build
	// will detect anyOf/oneOf and return multiple resolved object maps.
	// The definition object will contain `properties` and possibly `objects`
	// if encountering an allOf/anyOf/oneOf case. Each object will
	// be a definition object.
	//
	// @param schema object - a valid schema object
	// @return object - definition object
	buildDefinition : function (schema) {
		var def = {properties : {}};

		if (schema.title) {
			def.title = schema.title;
		}

		if (_.isArray(schema)) {
			_.each(schema, function (_schema) {
				def.properties = _.extend(
					def.properties,
					this.buildDefinition(_schema).properties
				);
			}, this);
		} else if (schema.allOf) {
			_.each(schema.allOf, function (_schema) {
				var _def = this.buildDefinition(_schema);

				// Could this be abstracted in this method?
				if (_def.objects) {
					_def = this.buildDefinition(_def.objects);
				}

				def.properties = _.extend(def.properties, _def.properties);
			}, this);

			// Build the required attributes and merged example data object for the `allOf` case
			def.required = this.buildRequiredObjectParameterMap(schema, schema.required);
			def.example = this._stringifyData(this.buildExampleData(schema, schema), true);

		} else if (schema.oneOf || schema.anyOf) {
			var items = schema.oneOf || schema.anyOf;
			def.objects = _.map(items, this.buildDefinition, this);
		} else {
			_.extend(def.properties, this.buildObjectParameterMap(schema));
			// Provide required attributes and an example data object for the schema
			def.required = this.buildRequiredObjectParameterMap(schema, schema.required);
			def.example = this._stringifyData(this.buildExampleData(schema, schema), true);
		}

		return def;
	},

	// Returns a curl formatted string. Data provided will be json encoded for now.
	// @todo allow custom/additional flags
	//
	// @param href string - a formatted `href`
	// @param method string - HTTP method
	// @param headers object - Headers to be built with the request
	// @param data object [optional] - Data for the request
	buildCurl : function (href, method, headers, data) {
		var url = this.apiURL + href,
			flags = [],
			curl = '';

		_.each(headers, function (v, k) {
			flags.push(this._buildCurlFlag('H', k+': '+v));
		}, this);

		if (data) {
			if ('GET' === method) {
				url += this._buildQueryString(data);
			} else {
				flags.push(this._buildCurlFlag('-data', this._stringifyData(data), '\''));
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
	//
	// @param root object - A valid schema
	// @param schema object - A valid schema
	// @param options object [optional] - Configuration for resolving example data
	// @return object - attribute/example data object
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
	//
	// @param root object - A valid schema
	// @param properties object - Object properties to find example data from
	// @return object - Resolved attributes with example data as values
	buildExampleProperties : function (root, properties) {
		return _.reduce(properties, function (props, config, name) {
			// Ignore any note properties (__notes)
			if (name.indexOf('__') === 0) {return props;}

			var example = config.example || config.default;

			// If the property is referencing a defintion, we
			// have to dig a level deeper for the example data
			if (_.isPlainObject(example) && (_.has(example, 'example') || _.has(example, 'default'))) {
				example = _.has(example, 'example') ? example.example : example.default;
			// Resolve the root schema
			} else if (config.rel === 'self') {
				example = this.buildExampleData(root, root);
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

	// Stringify a given object. Defaults to JSON encoding,
	// but you can override this to encode your data in a different way.
	//
	// @param data object - Object to be stringified
	// @param prettyPrint boolean - Whether to "pretty print" the string
	// @return string
	_stringifyData : function (data, prettyPrint) {
		return JSON.stringify(data, null, prettyPrint ? 2 : void 0);
	},

	// Builds a cURL flag
	//
	// @param flag string
	// @param val string
	// @param quoteType [optional] - typically a single or double quote
	// @return string
	_buildCurlFlag : function (flag, val, quoteType) {
		quoteType = quoteType || '"';
		return ['-', flag, ' ', quoteType, val, quoteType].join('');
	},

	// Scrub a string and remove invalid characters for HTML attribute values
	//
	// @param val string
	// @param string - santized string
	_sanitizeHTMLAttributeValue : function (val) {
		return val.toString().toLowerCase().replace(/[\s.,;'=<>\/]+/gi, '-');
	},

	// Build a URL query string from an object. Expects strings for all values
	//
	// @param obj object
	// @param noQ boolean - Add initial question mark for query
	// @return string
	_buildQueryString : function (obj, noQ) {
		var firstJoin = noQ ? '&' : '?';
		return _.reduce(obj, function (str, val, key) {
			var conn = (str === firstJoin) ? '' : '&';
			return str + conn + key + '='+ val;
		}, firstJoin);
	}
});
