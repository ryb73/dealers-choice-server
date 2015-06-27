"use strict";

const assert            = require("chai").assert,
      RockPaperScissors = require("./rock-paper-scissors");

function ChoiceProvider($broadcast) {
  let broadcast;
  let game;
  let choiceHandlers = new Map(); // <handler ID, handler>

  function initialize() {
    broadcast = $broadcast;
    $broadcast = null;
  }

  function rockPaperScissors() {
    // Create handler and store reference to it so that
    // it can be referenced later. There could be multiple
    // concurrent choices (theoretically -- not sure yet
    // if that'll actually happen in practice) so clients
    // need to specifically reference the choice they're
    // answering
    let handler = new RockPaperScissors(game);
    choiceHandlers.set(handler.id, handler);

    return handler.handleIt(broadcast)
      .tap(function() {
        // Delete the handler when done
        choiceHandlers.delete(handler.id);
      });
  }
  this.rockPaperScissors = rockPaperScissors;

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