"use strict";

const _                     = require("lodash"),
      q                     = require("q"),
      SwappableProxy        = require("swappable-proxy"),
      MessageType           = require("dc-constants").MessageType,
      log                   = require("rpb-logging")("dc-server"),
      addGameStateListeners = require("../add-game-state-listeners"),
      ChoiceProvider        = require("./choice-provider"),
      GameManager           = require("./game-manager");

function InProgressGameManager($oldManager, $factory, $preset) {
  GameManager.call(this, $oldManager);
  let supr = _.clone(this);
  let self = this;

  let proxy = new SwappableProxy(this);

  let choiceProvider,
      game,
      defPlayersReady = {};

  function initialize() {
    choiceProvider = new ChoiceProvider(self._callbacks);
    game = $factory.createGame(choiceProvider, $preset);
    choiceProvider.game = game;

    addGameStateListeners(game.gameData, self._callbacks);

    game.players.forEach((player) => {
      defPlayersReady[player.id] = q.defer();
    });

    q.all(_.map(defPlayersReady, "promise"))
      .done(start);

    $oldManager = $factory = $preset = null;
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
    } else if(msg.cmd === MessageType.CanPlayDcCard) {
      handleCanPlayDcCard(player, msg, ack);
    } else {
      supr.performCommand(player, msg, ack);
    }
  }
  this.performCommand = performCommand;

  function handleCanPlayDcCard(player, msg, ack) {
    let cardId = msg.cardId;
    let card = player.dcCards[cardId];
    if(!card)
      ack(false);

    ack(card.canPlay(player, game.gameData));
  }

  initialize();

  return proxy.instance;
}

InProgressGameManager.prototype = GameManager.prototype;

module.exports = InProgressGameManager;