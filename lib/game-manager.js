"use strict";

var dcEngine    = require("dc-engine"),
    GameFactory = dcEngine.GameFactory;

function GameManager() {
  var self = this;
  var factory = new GameFactory({}, self);
  var playerCallbacks = {};

  function addPlayer(callback) {
    var player = factory.addPlayer();
    playerCallbacks[player.hashCode()] = callback;
  }
  this.addPlayer = addPlayer;

  function uuid() {
    return factory.hashCode();
  }
  this.uuid = uuid;
}

module.exports = GameManager;