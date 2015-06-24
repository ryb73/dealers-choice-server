"use strict";

var _                 = require("lodash"),
    RockPaperScissors = require("./rock-paper-scissors");

function ChoiceProvider() {
  let broadcast;
  let choiceHandlers = new Map();

  function rockPaperScissors() {
    let handler = new RockPaperScissors(broadcast);
    choiceHandlers.set(handler.id, handler);
    return handler.handleIt()
      .tap(function() {
        // Delete the handler when done
        choiceHandlers.delete(handler.id);
      });
  }
  module.exports = rockPaperScissors;

  function giveAnswer(player, answer) {
    // Get the specified handler. If it doesn't exist,
    // then we'll assume that the answer is just coming
    // in late and ignore it silently
    let handler = choiceHandlers.get(answer.handlerId);
    if(!handler) return;

    handler.giveAnswer(player, answer);
  }
  this.giveAnswer = giveAnswer;

  Object.defineProperties(this, {
    broadcast: {
      set: function(val) {
        broadcast = val;
      }
    }
  });

  _.fill(arguments, null);
}

module.exports = ChoiceProvider;