"use strict";

const _              = require("lodash"),
      SwappableProxy = require("swappable-proxy"),
      MessageType    = require("dc-constants").MessageType,
      ChoiceProvider = require("./choice-provider"),
      GameManager    = require("./game-manager");

function InProgressGameManager($oldManager, $factory) {
  GameManager.call(this, $oldManager);
  let supr = _.clone(this);
  let self = this;

  let proxy = new SwappableProxy(this);

  let choiceProvider;
  let game;

  function initialize() {
    choiceProvider = new ChoiceProvider(self._callbacks);
    game = $factory.createGame(choiceProvider);
    choiceProvider.game = game;

    asyncGameLoop();

    $oldManager = $factory = null;
  }

  function asyncGameLoop() {
    game.doNext()
      .then(function(continueGame) {
        if(continueGame) asyncGameLoop();
        else gameOver();
      });
  }

  function gameOver() {
    throw new Error("Game over!");
  }

  function performCommand(player, msg, ack) {
    if(msg.cmd === MessageType.Choice) {
      choiceProvider.giveAnswer(player, msg.answer);
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