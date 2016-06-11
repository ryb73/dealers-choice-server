"use strict";

const _                     = require("lodash"),
      SwappableProxy        = require("swappable-proxy"),
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
  let owner;

  // callback is used to send messages to
  // the players in the game
  function addPlayer(userId, callbacks) {
    let player = factory.addPlayer();
    if(!player) return null;

    self._callbacks.set(player, callbacks);

    // If the game didn't have an owner, it does now
    // This should only happen when the game is first created
    // and the initial player is added
    if(!owner)
      owner = player;

    self._users.set(userId, { id: userId, player });

    return player;
  }
  this.addPlayer = addPlayer;

  function removePlayer(player) {
    factory.removePlayer(player);
    self._callbacks.remove(player);

    let user = _.find(_.toArray(self._users.values()), {
      player: { id: player.id }
    });
    self._users.delete(user.id);

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

    // If we're able to start the game, then delegate to a
    // new game manager which will actually start the game
    // and manage the gameplay.
    let factoryStatus = factory.status();
    let newGameManager;
    if(factoryStatus === PendingGameStatus.ReadyToStart) {
      newGameManager = new InProgressGameManager(self, factory);
      proxy.swap(newGameManager);
    }

    // Either way, send an appropriate acknowledgement
    ack({ result: factoryStatusToResponseCode(factoryStatus) });
    self._callbacks.toOthers(player, "action", {
      cmd: MessageType.GameStarted
    });
  }
  this.startGame = startGame;

  function performCommand(player, msg, ack) {
    if(msg.cmd === MessageType.StartGame) {
      startGame(player, ack);
    } else {
      supr.performCommand(player, msg, ack);
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
    }
  });

  return proxy.instance;
}

PendingGameManager.prototype = Object.create(GameManager);

module.exports = PendingGameManager;