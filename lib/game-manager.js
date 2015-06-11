"use strict";

var dcEngine     = require("dc-engine"),
    GameFactory  = dcEngine.GameFactory,
    MessageType  = require("./message-type"),
    ResponseCode = require("./response-code");

function GameManager() {
  var self = this;
  var factory = new GameFactory({}, self);
  var game;
  var playerCallbacks = {};

  // callback is used to send messages to
  // the players in the game
  function addPlayer(callbacks) {
    var player = factory.addPlayer();
    if(player)
      playerCallbacks[player.hashCode()] = callbacks;
    return player;
  }
  this.addPlayer = addPlayer;

  function startGame() {
    game = factory.createGame();
    if(game) {
      factory = null;
    }
  }
  this.startGame = startGame;

  function performCommand(player, msg, ack) {
    if(msg.cmd === MessageType.Chat) {
      sendChat(player, msg.message);
      ack({ result: ResponseCode.ChatSent });
    } else {
      cbFor(player).toYou("gameError", "Unexpected command: " + msg.cmd);
    }
  }
  this.performCommand = performCommand;

  function sendChat(player, message) {
    var msg = {
      playerId: player.hashCode(),
      message: message
    };
    cbFor(player).toOthers("chat", msg);
  }

  function cbFor(player) {
    return playerCallbacks[player.hashCode()];
  }

  function uuid() {
    return factory.hashCode();
  }
  this.uuid = uuid;
}

module.exports = GameManager;