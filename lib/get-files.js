// Simple helper methods that take an array of file paths and will
// read them from the file system.
'use strict';

var _ = require('lodash'),
	Promise = require('bluebird'),
	fs = require('fs'),
	getFiles = {};

module.exports = getFiles;

// Takes an array of file paths and will resolve with an object where
// the keys are the file paths and the values are the raw file contents.
//
// @param filePaths array
// @return Promise
getFiles.raw = function (filePaths) {
	return new Promise(function (resolve, reject) {
		var fileReads = [], contents = {};

		filePaths.forEach(function (path) {
			fileReads.push(new Promise(function(res, rej){
				fs.readFile(path, 'utf8', function (err, data) {
					if (err) rej(err);
					contents[path] = data;
					res();
				});
			}));
		});

		Promise.all(fileReads).then(function(){ resolve(contents); }, reject);
	});
};

// Same as the `.raw()` method, except this method will attempt to parse
// the file contents as JSON.
// @param filePaths array
// @return Promise
getFiles.asJSON = function (filePaths) {
	return new Promise(function (resolve, reject) {
		var fileParses = [], json = {};

		getFiles.raw(filePaths).then(function (contents) {
			_.each(contents, function(data, path){
				var p = new Promise(function(res, rej){
					try {
						json[path] = JSON.parse(data);
						res();
					} catch (e) { rej(e); }
				});

				p.catch(reject);
				fileParses.push(p);
			});

			Promise.all(fileParses).then(function(){
				// Finally done
				resolve(json);
			}, reject);
		});
	})
};
