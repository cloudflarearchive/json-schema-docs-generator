// Documentation generation flow
// =============================
// The default flow for generating documentation. Pass in options for customizing
// the flow.
'use strict';
var Promise = require('bluebird');
var resolveGlobs = require('./resolve-globs');
var saveFiles = require('./save-files');
var GEN_PREFIX = 'Generate Flow: ';
var colors = require('colors');
var _ = require('lodash');
var Handlebars = require('handlebars');

module.exports = function (generator, options, runtimeOpts) {
	var globOptions = options.globOptions;
	var expandSchemas = resolveGlobs(options.schemas, globOptions);
	var expandTemplates = resolveGlobs(options.theme ? './node_modules/json-schema-docs-generator/themes/'+options.theme+'/*' : options.templates, globOptions);
	var defaultPostTemplateCompilation = function (templates) {
		// Register each template as a partial for Handlebars
		return _.each(templates, function (acc, compiledSource, name) {
			Handlebars.registerPartial(name, compiledSource);
		});
	};

	return Promise.props({
		schemas : expandSchemas,
		templates : expandTemplates
	}).then(function (result) {
		// Set the expanded schemas and templates config
		generator.schemas = result.schemas;
		generator.templates = result.templates;

		// Info
		if (runtimeOpts.verbose) {
			console.log(GEN_PREFIX+'Will Resolve: '+generator.schemas.length+' schemas');
			console.log(GEN_PREFIX+'Will Ignore: '+generator.dontParse.length+' files');
			console.log(GEN_PREFIX+'Will Compile: '+generator.templates.length+' templates');
			console.log(GEN_PREFIX+'Skipping docs for '+ generator.noDocs.length+ ' schemas');
			console.log(options.id+' ---------------------------------');
		}

		// Deal with templates
		var templates = generator
			.parseTemplates()
			.bind(generator)
			.then(_.partial(generator.compileTemplates, options.templateCompiler || Handlebars.compile))
			.then(options.postTemplateCompilation || defaultPostTemplateCompilation)
			.catch(function (err) {
				console.error(GEN_PREFIX+'Error '.red+'compiling templates: '+err);
			});

		// Deal with schemas
		var schemas = generator
			.parseSchemas()
			.bind(generator)
			.then(generator.resolveSchemas)
			.catch(function (err) {
				console.error(GEN_PREFIX+'Error '.red+'resolving schemas: '+err);
			});

		// Once both templates and schemas are ready, build the page(s)
		return Promise.props({templates : templates, schemas : schemas})
			.bind(generator)
			.then(function (result) {
				// Make the page(s) and write pages to disk
				_.each(generator.makeHTML(result.templates, result.schemas), _.partial(options.saveFiles || saveFiles, options.destination));
			}).catch(function (err) {
				console.error(GEN_PREFIX+'Error '.red+'generating HTML: '+err);
			});
	}).catch(function (err) {
		console.error(GEN_PREFIX+'Error '.red+'expanding file paths: '+err);
	});
};
