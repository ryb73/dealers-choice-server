"use strict";

const _                     = require("lodash"),
      SwappableProxy        = require("swappable-proxy"),
      toArray               = require("iterator-to-array"),
      GameFactory           = require("dc-game-factory"),
      PendingGameStatus     = GameFactory.PendingGameStatus,
      dcConstants           = require("dc-constants"),
      MessageType           = dcConstants.MessageType,
      ResponseCode          = dcConstants.ResponseCode,
      GameManager           = require("./game-manager"),
      InProgressGameManager = require("./in-progress-game-manager");

function PendingGameManager() {
  GameManager.call(this);
  let supr = _.clone(this);
  let self = this;

  let proxy = new SwappableProxy(this);

  //TODO: implement actual decks
  let decks = { carDeck: [], dcDeck: [], insuranceDeck: [] };
  let factory = new GameFactory(decks);
  let users = new Map(); // User ID -> User
  let owner;

  // callback is used to send messages to
  // the players in the game
  function addPlayer(user, callbacks) {
    let player = factory.addPlayer();
    if(!player) return null;

    self._callbacks.set(player, callbacks);

    user.player = player;
    users.set(user.id, user);

    // If the game didn't have an owner, it does now
    // This should only happen when the game is first created
    // and the initial player is added
    if(!owner)
      owner = user;

    return player;
  }
  this.addPlayer = addPlayer;

  function removePlayer(user) {
    factory.removePlayer(user.player);
    self._callbacks.remove(user.player);
    users.remove(user.id);

    if(owner === user) {
      owner = toArray(users.values())[0];
    }
  }
  this.removePlayer = removePlayer;

  function isEmpty() {
    return users.size === 0;
  }
  this.isEmpty = isEmpty;

  function startGame(user, ack) {
    // Only the owner can start the game
    if(user !== owner) {
      ack({ result: ResponseCode.StartError });
      return;
    }

    // If we're able to start the game, then delegate to a
    // new game manager which will actually start the game
    // and manage the gameplay.
    let factoryStatus = factory.status();
    if(factoryStatus === PendingGameStatus.ReadyToStart) {
      let newGameManager = new InProgressGameManager(self, factory);
      proxy.swap(newGameManager);
    }

    // Either way, send an appropriate acknowledgement
    ack({ result: factoryStatusToResponseCode(factoryStatus) });
  }
  this.startGame = startGame;

  function performCommand(user, msg, ack) {
    if(msg.cmd === MessageType.StartGame) {
      startGame(user, ack);
    } else {
      supr.performCommand(user, msg, ack);
    }
  }
  this.performCommand = performCommand;

  function factoryStatusToResponseCode(factoryStatus) {
    switch(factoryStatus) {
      case PendingGameStatus.ReadyToStart:
        return ResponseCode.StartOk;
      case PendingGameStatus.NotEnoughPlayers:
        return ResponseCode.StartNotEnoughPlayers;
    }

    return null;
  }

  Object.defineProperties(this, {
    id: {
      enumerable: true,
      get: factory.hashCode
    },

    users: {
      enumerable: true,
      get: function() {
        return _.clone(users);
      }
    }
  });

  return proxy.instance;
}

PendingGameManager.prototype = Object.create(GameManager);

module.exports = PendingGameManager;