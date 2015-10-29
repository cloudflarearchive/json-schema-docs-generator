'use strict';

var _ = require('lodash');
var DEBUG_PREFIX = 'JSON Docs: ';

/**
 * Print a message to the console if the object
 * this method was mixed into was configured for it.
 *
 * @module helpers/debug
 * @type {Function}
 * @param level
 */
module.exports = function(level) {
  var args = _.rest(arguments);
  var debugLevel = this.debugLevel;
  //var args = [].slice.call(arguments, 1);
  if (debugLevel && level <= debugLevel ) {
    args[0] = DEBUG_PREFIX + args[0];
    global.console.log.apply(global.console.log, args);
  }
};
