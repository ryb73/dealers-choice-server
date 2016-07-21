"use strict";

const _                     = require("lodash"),
      SwappableProxy        = require("swappable-proxy"),
      GameFactory           = require("dc-game-factory"),
      PendingGameStatus     = GameFactory.PendingGameStatus,
      dcConstants           = require("dc-constants"),
      MessageType           = dcConstants.MessageType,
      ResponseCode          = dcConstants.ResponseCode,
      Symbols               = dcConstants.Symbols,
      PlayerTurnBeginState  = require("dc-game-states").PlayerTurnBeginState,
      GameManager           = require("./game-manager"),
      InProgressGameManager = require("./in-progress-game-manager"),
      config                = require("config").get("dc-server");

function PendingGameManager() {
  GameManager.call(this);
  let supr = _.clone(this);
  let self = this;

  let proxy = new SwappableProxy(this);

  let factory = new GameFactory(config.deckConfig),
      owner;

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

    self._users[userId] = { id: userId, player };

    return player;
  }
  this.addPlayer = addPlayer;

  function removePlayer(player) {
    factory.removePlayer(player);
    self._callbacks.remove(player);

    let user = _.find(self._users, {
      player: { id: player.id }
    });
    delete self._users[user.id];

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

    let preset;
    preset = {
      state: {
        class: PlayerTurnBeginState,
        args: [ Symbols.player1 ]
      },
      players: [{
        money: 17000,
        dcCards: [ "list3", ..._.fill(new Array(4), Symbols.random) ],
        cars: [ 24 , ..._.fill(new Array(3), Symbols.random) ],
        insurances: [ "fire" ]
      }, {
        money: 17000,
        dcCards: _.fill(new Array(5), Symbols.random),
        cars: _.fill(new Array(4), Symbols.random),
        insurances: [ Symbols.random ]
      }]
    };

    // If we're able to start the game, then delegate to a
    // new game manager which will actually start the game
    // and manage the gameplay.
    let factoryStatus = factory.status();
    let newGameManager;
    if(factoryStatus === PendingGameStatus.ReadyToStart) {
      newGameManager = new InProgressGameManager(self, factory, preset);
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