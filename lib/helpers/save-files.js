'use strict';

var fs = require('fs');
var mkdir = require('mkdir-p');
var color = require('colors');

/**
 * Save a file (defaults to html)
 *
 * @param {String} [destination=dist]
 * @param {String} contents
 * @param {String} fileName
 * @param {String} [ext=.html]
 */
module.exports = function (destination, contents, fileName, ext){
  var folder = destination || 'dist';
  var path = [folder, '/', fileName, ext || '.html'].join('');

  mkdir(path, function(err) {
    if (err) {
      throw new Error(err);
    }

    fs.writeFile(path, contents, function (err) {
      if (err) {
        throw new Error(err);
      }
      global.console.log('Wrote file: ' + path.green);
    });
  });
};
