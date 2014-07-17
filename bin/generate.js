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
var mainConfig = require('../../../package')['json-schema-docs'];
var handleErr = function (where) {
	return function (err) {
		console.error(GEN_PREX+'Error '+where+': '+err);
	}
};

domain.on('error', function (err) {
	console.error(GEN_PREX+err);
});

domain.run(function(){
	// Allow multiple documentation packages to be defined.
	// We'll merge in the defaults of the main config for each.
	var packages = mainConfig.packages || {default: mainConfig},
		promiseChain = Promise.resolve();


	Promise.all(_.map(packages, function (config, key) {
		return new Promise(function (resolve, reject) {
			// Merge the defaults from the main config, less the packages.
			config = _.defaults(config, _.omit(mainConfig, ['packages']));
			var generator = new Generator(config);

			var resolveFiles = new Promise(function (resolve, reject) {
				var schemaConfig = {
					globs : [].concat(config.schemas),
					paths : [],
					done : false
				};
				var templateConfig = {
					globs : [].concat(config.theme ? './node_modules/json-schema-docs-generator/themes/'+config.theme+'/*' : config.templates),
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

			// Build/generate
			resolveFiles.then(function (opts) {
				// Set the expanded schemas and templates config
				generator.schemas = opts.schemas;
				generator.templates = opts.templates;

				// Info
				console.log(GEN_PREX+'Resolving '+generator.schemas.length+' schemas');
				console.log(GEN_PREX+'Ignoring '+generator.dontParse.length+' files');
				console.log(GEN_PREX+'Compiling '+generator.templates.length+' templates');
				console.log(GEN_PREX+'Skipping docs for '+ generator.noDocs.length+ ' schemas');
				console.log(key+' -----^---------------------------');

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
					}, handleErr('Compiling Templates'));

				// Deal with schemas
				var schemas = generator
					.parseSchemas()
					.bind(generator)
					.then(generator.resolveSchemas, handleErr('Resolving schemas'));

				// Once both templates and schemas are ready, build the page(s)
				return Promise.props({templates : templates, schemas : schemas})
					.bind(generator)
					.then(function (result) {
						// Make the page(s) and write pages to disk
						_.each(generator.makeHTML(result.templates, result.schemas), function (contents, fileName){
							var folder = (config.destination || 'dist');
							var path = [folder, '/', fileName, '.html'].join('');

							// Check if the location exists before
							// trying to save.
							fs.exists(folder, function (exists) {
								if (exists) {
									fs.writeFile(path, contents, function (err) {
										if (err) { throw new Error(err); }
										console.log(GEN_PREX+'Wrote file: '+path);
										resolve();
									});
								} else {
									reject(folder+' does not exist. Sorry, I\'m not creating it for you yet.');
								}
							});
						});
					}, handleErr('Resolving schemas/templates'));
				});
		}, handleErr('Fetching schema and templates files'));
	})).then(function () {
		console.log('--------------------------------------');
		console.log(GEN_PREX+'Build took '+ process.uptime() + ' seconds');
	});
});
