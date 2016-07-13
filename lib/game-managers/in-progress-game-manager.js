"use strict";

const _              = require("lodash"),
      q              = require("q"),
      SwappableProxy = require("swappable-proxy"),
      MessageType    = require("dc-constants").MessageType,
      log            = require("rpb-logging")("dc-server"),
      ChoiceProvider = require("./choice-provider"),
      GameManager    = require("./game-manager");

function InProgressGameManager($oldManager, $factory) {
  GameManager.call(this, $oldManager);
  let supr = _.clone(this);
  let self = this;

  let proxy = new SwappableProxy(this);

  let choiceProvider,
      game,
      users,
      defPlayersReady = {};

  function initialize() {
    users = $oldManager.users;
    choiceProvider = new ChoiceProvider(self._callbacks);
    game = $factory.createGame(choiceProvider);
    choiceProvider.game = game;

    game.players.forEach((player) => {
      defPlayersReady[player.id] = q.defer();
    });

    q.all(_.map(defPlayersReady, "promise"))
      .done(start);

    $oldManager = $factory = null;
  }

  function asyncGameLoop() {
    // TODO: is this safe?
    game.doNext()
      .done(function(continueGame) {
        if(continueGame) asyncGameLoop();
        else gameOver();
      });
  }

  function start() {
    asyncGameLoop();
  }
  this.start = start;

  function gameOver() {
    throw new Error("Game over!");
  }

  function performCommand(player, msg, ack) {
    if(msg.cmd === MessageType.Choice) {
      choiceProvider.giveAnswer(player, msg.answer);
    } else if(msg.cmd === MessageType.ActuallyReady) {
      defPlayersReady[player.id].resolve();
    } else {
      supr.performCommand(player, msg, ack);
    }
  }
  this.performCommand = performCommand;

  initialize();

  return proxy.instance;
}

InProgressGameManager.prototype = GameManager.prototype;

module.exports = InProgressGameManager;