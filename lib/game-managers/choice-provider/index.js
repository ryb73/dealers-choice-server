"use strict";

const config            = require("config").get("dc-server"),
      assert            = require("chai").assert,
      rpbLogging        = require("rpb-logging"),
      log               = rpbLogging("dc-server", config.logLevel),
      RockPaperScissors = require("./rock-paper-scissors"),
      Replenish         = require("./replenish");

function ChoiceProvider($callbacks) {
  let callbacks;
  let game;
  let choiceHandlers = new Map(); // <handler ID, handler>

  function initialize() {
    callbacks = $callbacks;
    $callbacks = null;
  }

  function rockPaperScissors() {
    return handleGeneric(new RockPaperScissors(game));
  }
  this.rockPaperScissors = rockPaperScissors;

  function doReplenish(player) {
    return handleGeneric(new Replenish(player));
  }
  this.doReplenish = doReplenish;

  function handleGeneric(handler) {
    // Create handler and store reference to it so that
    // it can be referenced later. There could be multiple
    // concurrent choices (theoretically -- not sure yet
    // if that'll actually happen in practice) so clients
    // need to specifically reference the choice they're
    // answering
    choiceHandlers.set(handler.id, handler);

    return handler.handleIt(callbacks)
      .tap(function() {
        // Delete the handler when done
        choiceHandlers.delete(handler.id);
      });
  }

  function giveAnswer(player, answer) {
    // Get the specified handler. If it doesn't exist,
    // then we'll assume that the answer is just coming
    // in late and ignore it silently
    let handler = choiceHandlers.get(answer.handlerId);
    if(!handler) {
      log.warn("Trying to give answer to nonexistant handler: " + answer.handlerId);
      return;
    }

    handler.giveAnswer(player, answer);
  }
  this.giveAnswer = giveAnswer;

  Object.defineProperties(this, {
    game: {
      set: function(val) {
        assert.notOk(game); // only set once
        game = val;
      }
    }
  });

  initialize();
}

module.exports = ChoiceProvider;