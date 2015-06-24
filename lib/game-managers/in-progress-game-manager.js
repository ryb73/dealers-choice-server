"use strict";

const _                     = require("lodash"),
      SwappableProxy        = require("swappable-proxy"),
      MessageType           = require("../message-type"),
      ResponseCode          = require("../response-code"),
      ChoiceProvider        = require("./choice-provider"),
      GameManager           = require("./game-manager");

function InProgressGameManager($factory) {
  GameManager.call(this);
  let supr = _.clone(this);
  let self = this;

  let choiceProvider = new ChoiceProvider();
  let game;

  function initialize() {
    game = $factory.startGame(choiceProvider);
    $factory = null;
  }

  initialize();
}

InProgressGameManager.prototype = GameManager.prototype;

module.exports = InProgressGameManager;