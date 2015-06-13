"use strict";

const dcEngine     = require("dc-engine"),
      GameFactory  = dcEngine.GameFactory,
      MessageType  = require("./message-type"),
      ResponseCode = require("./response-code");

function GameManager() {
  let self = this;
  let factory = new GameFactory({}, self);
  let game;
  let playerCallbacks = new Map();

  // callback is used to send messages to
  // the players in the game
  function addPlayer(callbacks) {
    let player = factory.addPlayer();
    if(player)
      playerCallbacks.set(player, callbacks);
    return player;
  }
  this.addPlayer = addPlayer;

  function removePlayer(player) {
    factory.removePlayer(player);
    playerCallbacks.delete(player);
  }
  this.removePlayer = removePlayer;

  function isEmpty() {
    return factory.playerCount === 0;
  }
  this.isEmpty = isEmpty;

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
    let msg = {
      playerId: player.id,
      message: message
    };
    cbFor(player).toOthers("chat", msg);
  }

  function cbFor(player) {
    return playerCallbacks.get(player);
  }

  Object.defineProperties(this, {
    id: {
      enumerable: true,
      get: factory.hashCode
    },

    playerCount: {
      enumerable: true,
      get: function() {
        return factory.playerCount;
      }
    }
  });
}

module.exports = GameManager;