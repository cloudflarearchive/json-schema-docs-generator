'use strict';

var _ = require('lodash');
// JSON stringify parameters
var DEFAULTS = {
  replacer: undefined,
  space: 2
};

/**
 * @class JSONFormatter
 * @module lib/formatters/json
 * @type {{format: Function}}
 */
module.exports = {
  /**
   * @param {mixed} data
   * @param {Function} [replacer]
   * @param {Number} [space]
   * @returns {string}
   */
  format: function(data, replacer, space) {
    replacer = !_.isUndefined(replacer) ? replacer : DEFAULTS.replacer;
    space = !_.isUndefined(space) ? space : DEFAULTS.space;
    return JSON.stringify(data, replacer, space);
  }
};
