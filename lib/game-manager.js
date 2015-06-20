"use strict";

const dcEngine       = require("dc-engine"),
      GameFactory    = dcEngine.GameFactory,
      MessageType    = require("./message-type"),
      ResponseCode   = require("./response-code"),
      ChoiceProvider = require("./choice-provider");

function GameManager() {
  let choiceProvider = new ChoiceProvider();
  let factory = new GameFactory({}, choiceProvider);
  let game;
  let playerCallbacks = new Map();
  let toAll;

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
    } else if(msg.cmd === MessageType.Choice) {
      choiceProvider.giveAnswer(player, msg.answer);
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
    },

    roomCallback: {
      set: function(val) {
        toAll = val;
        choiceProvider.broadcast = toAll;
      }
    }
  });
}

module.exports = GameManager;