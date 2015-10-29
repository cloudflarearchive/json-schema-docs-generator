'use strict';

var path = require('path');
var mkdir = require('mkdirp-then');
var color = require('colors');
var Promise = require('bluebird');
var writeFile = Promise.promisify(require('fs').writeFile);

/**
 * Save a file
 *
 * @param {String} [destination=dist]
 * @param {String} contents
 * @param {String} fileName
 */
module.exports = function (destination, contents, filepath){
  var directory = destination + '/' + path.dirname(filepath);
  var fullPath = destination + '/' + filepath;

  return mkdir(directory).then(function() {
    writeFile(fullPath, contents).then(function() {
      global.console.log('Wrote file: ' + fullPath.green);
    });
  });
};
