'use strict';

var _ = require('lodash');

module.exports = {

  formatter: require('../formatters/json'),

  config: {
    HEADER_SEPARATOR: ': ',
    NEW_LINE: ' \\\n\t\t'
  },

  /**
   * Build a cURL string
   *
   * @param {String} uri
   * @param {String} [method=GET]
   * @param {Object} [headers]
   * @param {Object|Array} [data]
   * @returns {String}
   */
  generate: function(uri, method, headers, data) {
    var config = this.config;
    var flags = [];
    var str;

    method = method || 'GET';
    str = ['curl', this.buildFlag('X', method.toUpperCase(), ''), '"' + uri + '"'].join(' ');

    _.each(headers, function(val, header) {
      flags.push(this.buildFlag('H', header + config.HEADER_SEPARATOR + val));
    }, this);

    if (data) {
      if (method.toLowerCase() === 'get') {
        str += this.buildQueryString(data);
      } else {
        flags.push(this.buildFlag('-data', this.formatData(data), '\''));
      }
    }

    return str + config.NEW_LINE + flags.join(config.NEW_LINE);
  },

  /**
   * @param {mixed} data
   * @returns {String}
   */
  formatData: function(data) {
    return this.formatter.format(data, null, 0);
  },

  /**
   * @param {String} type
   * @param {String} value
   * @param {String} [quoteType=\"]
   * @returns {String}
   */
  buildFlag: function(type, value, quoteType) {
    quoteType = !_.isUndefined(quoteType) ? quoteType : '"';
    return ['-', type, ' ', quoteType, value, quoteType].join('');
  },

  /**
   *
   * @param data
   * @param {Boolean} [noQueryString=true]
   * @returns {String}
   */
  buildQueryString: function(data, noQueryString) {
    var firstJoin = noQueryString ? '&' : '?';
    return _.reduce(data, function (str, val, key) {
      var conn = (str === firstJoin) ? '' : '&';
      return str + conn + key + '=' + val;
    }, firstJoin);
  }
};
