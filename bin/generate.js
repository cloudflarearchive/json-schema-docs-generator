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
var dontParse = config.dontParse || [];
var handleErr = function (err) { console.error(GEN_PREX+err); };

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
								schemaPaths: schemaConfig.paths,
								templatePaths: templateConfig.paths
							});
						}
					}
				});
			});
		};

		get(schemaConfig);
		get(templateConfig);
	});

	// Build/Generate
	resolveFiles.then(function (opts) {
		var generator = new Generator(_.extend({}, config, {
			compiler : Handlebars.compile,
			schemas : opts.schemaPaths,
			templates : opts.templatePaths,
			dontParse: dontParse
		}));

		// Info
		console.log(GEN_PREX+'Resolving '+opts.schemaPaths.length+' schemas');
		console.log(GEN_PREX+'Ignoring '+dontParse.length+' files');
		console.log(GEN_PREX+'Compiling '+opts.templatePaths.length+' templates');
		console.log(GEN_PREX+'Skipping docs for '+ config.noDocs.length+ ' schemas');

		generator
			.resolvePaths()
			.then(function (schemasByID, templatesByPath) {
				// Compiled the templates
				generator.compileTemplates(generator.compiler);
				// Register each template as a partial for Handlebars
				_.each(generator.templateMap, function (compiledSource, name) {
					Handlebars.registerPartial(name, compiledSource);
				});
			}, handleErr)
			.then(function () {
				// Make the page(s)!
				var pages = generator.makeHTML();

				_.each(pages, function(contents, fileName){
					var path = [(config.dist || 'dist'), '/', fileName, '.html'].join('');
					console.log(GEN_PREX+'Writing file: '+path);
					fs.writeFile(path, contents);
				});

				console.log(GEN_PREX+'Build took '+ process.uptime() + ' seconds');
			}, handleErr);

	}, handleErr);
});
