"use strict";

const _                     = require("lodash"),
      SwappableProxy        = require("swappable-proxy"),
      dcEngine              = require("dc-engine"),
      GameFactory           = dcEngine.GameFactory,
      MessageType           = require("../message-type"),
      ResponseCode          = require("../response-code"),
      ChoiceProvider        = require("./choice-provider"),
      GameManager           = require("./game-manager"),
      InProgressGameManager = require("./in-progress-game-manager");

function PendingGameManager() {
  GameManager.call(this);
  let supr = _.clone(this);
  let self = this;

  let factory = new GameFactory({});
  let owner;
  let proxy = new SwappableProxy(this);

  // callback is used to send messages to
  // the players in the game
  function addPlayer(callbacks) {
    let player = factory.addPlayer();
    if(!player) return null;

    self._playerCallbacks.set(player, callbacks);

    // If the game didn't have an owner, it does now
    // This should only happen when the game is first created
    // and the initial player is added
    if(!owner)
      owner = player;

    return player;
  }
  this.addPlayer = addPlayer;

  function removePlayer(player) {
    factory.removePlayer(player);
    self._playerCallbacks.delete(player);

    if(owner === player) {
      owner = factory.players[0];
    }
  }
  this.removePlayer = removePlayer;

  function isEmpty() {
    return factory.players.length === 0;
  }
  this.isEmpty = isEmpty;

  function startGame(player, ack) {
    // Only the owner can start the game
    if(player !== owner) {
      ack({ result: ResponseCode.StartError });
      return;
    }

    if(factory.canStart()) {
      let newGameManager = new InProgressGameManager(factory);
      proxy.swap(newGameManager);
    }
  }
  this.startGame = startGame;

  function performCommand(player, msg, ack) {
    if(msg.cmd === MessageType.Choice) {
      choiceProvider.giveAnswer(player, msg.answer);
    } else if(msg.cmd === MessageType.StartGame) {
      startGame(player, ack);
    } else {
      supr.performCommand(player, msg, ack);
    }
  }
  this.performCommand = performCommand;

  Object.defineProperties(this, {
    id: {
      enumerable: true,
      get: factory.hashCode
    },

    playerCount: {
      enumerable: true,
      get: function() {
        return factory.players.length;
      }
    },

    roomCallback: {
      set: function(val) {
        choiceProvider.broadcast = val;
      }
    }
  });

  return proxy.instance;
}

PendingGameManager.prototype = Object.create(GameManager);

module.exports = PendingGameManager;