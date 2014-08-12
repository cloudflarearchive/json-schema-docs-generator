#!/usr/bin/env node

var GEN_PREX = 'JSON Docs: ';

var runtimeOpts = require('./args')(process.argv.slice(2));
var colors = require('colors');
var domain = require('domain').create();
var Promise = require('bluebird');
var Generator = require('../index');
var _ = require('lodash');

// !Better way to get this?
var mainConfig = require('../../../package')['json-schema-docs'];
var generate = require('../lib/helpers/generate-flow');

domain.on('error', function (err) {
	console.error(GEN_PREX.red+err);
});

domain.run(function(){
	// Allow multiple documentation packages to be defined.
	// We'll merge in the defaults of the main config for each.
	var packages = mainConfig.packages || {default: mainConfig};

	Promise.all(_.map(packages, function (config, key) {
		return new Promise(function (resolve, reject) {
			// Merge the defaults from the main config, less the packages.
			config = _.defaults(config, _.omit(mainConfig, ['packages']));

			var generator = new Generator(config, runtimeOpts);
			var processOptions = {
				id : key,
				globOptions : {strict: true}
			};

			return generate(generator, _.extend(processOptions, config), runtimeOpts).then(resolve, reject);

		}).catch(function (err) {
			console.error(GEN_PREX+'Error '.red+where+': '+err);
		});
	})).then(function () {
		console.log('--------------------------------------');
		console.log(GEN_PREX+'Build took '+ process.uptime() + ' seconds');
	});
});
