"use strict";

var _ = require("lodash");

function MockSocket() {
  var mockEmit = {};

  function on(event, callback) {
    mockEmit[event] = callback;
  }
  this.on = on;

  function emit(event, msg) { } // jshint ignore:line
  this.emit = emit;

  Object.defineProperties(this, {
    mockEmit: {
      enumerable: true,
      get: function() {
        return _.clone(mockEmit);
      }
    }
  });
}

module.exports = MockSocket;