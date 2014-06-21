#!/usr/bin/env node

var GEN_PREX = 'JSON Docs: ';

var args = require('./args')(process.argv.slice(2));
var domain = require('domain').create();
var Promise = require('bluebird');
var Generator = require('../index');
var glob = require('glob');
var globOptions = {strict: true};
var _ = require('lodash');
var Handlebars = require('handlebars');
var fs = require('fs');
// !Better way to get this?
var config = require('../../../package')['json-schema-docs'];
var handleErr = function (err) { console.error(GEN_PREX+'Error: '+err); };

domain.on('error', function (err) {
	console.error(GEN_PREX+err);
});

domain.run(function(){
	// Read in schema files
	var resolveFiles = new Promise(function (resolve, reject) {
		var schemaConfig = {
			globs : [].concat(config.schemas),
			paths : [],
			done : false
		};
		var templateConfig = {
			globs : [].concat(config.templates),
			paths : [],
			done : false
		};
		var get = function (item) {
			// Get all the files
			item.globs.forEach(function (g, i) {
				glob(g, globOptions, function (err, files) {
					if (err) return reject(err);
					// Merge in all the files
					item.paths = item.paths.concat(files);
					// End of this config
					if (i === item.globs.length-1) {
						item.done = true;
						// When we've reached the last, move on
						if (schemaConfig.done && templateConfig.done) {
							resolve({
								schemas: schemaConfig.paths,
								templates: templateConfig.paths
							});
						}
					}
				});
			});
		};

		// Resolve globs
		get(schemaConfig);
		get(templateConfig);
	});

	// Build/Generate
	resolveFiles.then(function (opts) {
		var generator = new Generator(_.extend({}, config, opts));

		// Info
		console.log(GEN_PREX+'Resolving '+generator.schemas.length+' schemas');
		console.log(GEN_PREX+'Ignoring '+generator.dontParse.length+' files');
		console.log(GEN_PREX+'Compiling '+generator.templates.length+' templates');
		console.log(GEN_PREX+'Skipping docs for '+ generator.noDocs.length+ ' schemas');

		// Deal with templates
		var templates = generator
			.parseTemplates()
			.bind(generator)
			.then(_.partial(generator.compileTemplates, Handlebars.compile))
			.then(function (templates) {
				// Register each template as a partial for Handlebars
				return _.each(templates, function (acc, compiledSource, name) {
					Handlebars.registerPartial(name, compiledSource);
				});
			}, handleErr);

		// Deal with schemas
		var schemas = generator
			.parseSchemas()
			.bind(generator)
			.then(generator.resolveSchemas);

		// Once both templates and schemas are ready, build the page(s)
		Promise.props({templates : templates, schemas : schemas})
			.bind(generator)
			.then(function (result) {
				// Make the page(s) and write pages to disk
				_.each(generator.makeHTML(result.templates, result.schemas), function (contents, fileName){
					var path = [(config.destination || 'dist'), '/', fileName, '.html'].join('');
					console.log(GEN_PREX+'Writing file: '+path);
					fs.writeFile(path, contents);
				});

				console.log(GEN_PREX+'Build took '+ process.uptime() + ' seconds');
			}, handleErr);
	}, handleErr);
});
