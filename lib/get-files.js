/**
 * Simple helper methods that take an array of file paths and will
 * read them from the file system.
 *
 * @module lib/get-files
 */
'use strict';

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var _ = require('lodash');
var getFiles = {};
/**
 * Takes an array of file paths and will resolve with an object where
 * the keys are the file paths and the values are the raw file contents.
 *
 * @param {array} filePaths
 * @returns {Promise}
 */
getFiles.raw = function (filePaths) {
  return Promise.reduce(filePaths, function(map, path) {
    return fs.readFileAsync(path, 'utf8')
      .then(function(contents) {
        map[path] = contents;
        return map;
      })
      .catch(function(e) {
        e.filePath = path;
        throw e;
      });
  }, {});
};

/**
 * Same as the `.raw()` method, except this method will attempt to parse
 * the file contents as JSON.
 *
 * @param {array} filePaths
 * @returns {Promise}
 */
getFiles.asJSON = function (filePaths) {
  return getFiles.raw(filePaths)
    .then(function(map) {
      return _.mapValues(map, function(str, filePath) {
        try {
          return JSON.parse(str);
        } catch (e) {
          e.filePath = filePath;
          throw e;
        }
      });
    })
    .catch(function(e) {
      throw new SyntaxError('Check your JSON syntax. Could not parse file: ' + e.filePath);
    });
};

module.exports = getFiles;
