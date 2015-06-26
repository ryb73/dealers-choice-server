"use strict";

const _                     = require("lodash"),
      SwappableProxy        = require("swappable-proxy"),
      MessageType           = require("../message-type"),
      ResponseCode          = require("../response-code"),
      ChoiceProvider        = require("./choice-provider"),
      GameManager           = require("./game-manager");

function InProgressGameManager($oldManager, $factory) {
  GameManager.call(this);
  let supr = _.clone(this);
  let self = this;

  let proxy = new SwappableProxy(this);

  let choiceProvider = new ChoiceProvider();
  let game;

  function initialize() {
    self.broadcast = $oldManager.broadcast;
    game = $factory.createGame(choiceProvider);
    $oldManager = $factory = null;
  }

  function performCommand(player, msg, ack) {
    if(msg.cmd === MessageType.Choice) {
      choiceProvider.giveAnswer(player, msg.answer);
    } else {
      supr.performCommand(player, msg, ack);
    }
  }
  this.performCommand = performCommand;

  Object.defineProperties(this, {
    broadcast: {
      enumerable: true,
      set: function(val) {
        supr.broadcast = val;
        choiceProvider.broadcast = val;
      },
      get: function() {
        return supr.broadcast;
      }
    }
  });

  initialize();

  return proxy.instance;
}

InProgressGameManager.prototype = GameManager.prototype;

module.exports = InProgressGameManager;