"use strict";

const _      = require("lodash"),
      assert = require("chai").assert;

function ClientCallbacks() {
  let playerCallbacks = new Map();
  let broadcast;

  function set(player, cbForPlayer) {
    playerCallbacks.set(player, cbForPlayer);
  }
  this.set = set;

  function remove(player) {
    playerCallbacks.delete(player);
  }
  this.remove = remove;

  function toYou(player) {
    playerCallbacks.get(player).toYou
      .apply(null, _.tail(arguments));
  }
  this.toYou = toYou;

  function toOthers(player) {
    playerCallbacks.get(player).toOthers
      .apply(null, _.tail(arguments));
  }
  this.toOthers = toOthers;

  Object.defineProperties(this, {
    broadcast: {
      enumerable: true,
      configurable: true,
      get: function() {
        return broadcast;
      },
      set: function(val) {
        assert.notOk(broadcast); // only set once
        broadcast = val;
      }
    }
  });
}

module.exports = ClientCallbacks;