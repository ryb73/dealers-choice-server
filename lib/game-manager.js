"use strict";

var dcEngine    = require("dc-engine"),
    GameFactory = dcEngine.GameFactory;

function GameManager() {
  var self = this;
  var factory = new GameFactory({}, self);
  var playerCallbacks = {};

  function addPlayer(callback) {
    var player = factory.addPlayer();
    if(player)
      playerCallbacks[player.hashCode()] = callback;
    return player;
  }
  this.addPlayer = addPlayer;

  function uuid() {
    return factory.hashCode();
  }
  this.uuid = uuid;
}

module.exports = GameManager;