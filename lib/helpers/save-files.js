// Save generated HTML to a file
// =============================
'use strict';

var fs = require('fs');
var color = require('colors');

module.exports = function (destination, contents, fileName){
	var folder = destination || 'dist';
	var path = [folder, '/', fileName, '.html'].join('');

	// Check if the location exists before
	// trying to save.
	fs.exists(folder, function (exists) {
		if (!exists) {
			throw new ReferenceError(folder+' does not exist. Sorry, I\'m not creating it for you yet.')
		}

		fs.writeFile(path, contents, function (err) {
			if (err) { throw new Error(err); }
			console.log('Wrote file: '+path.green);
		});
	});
};
