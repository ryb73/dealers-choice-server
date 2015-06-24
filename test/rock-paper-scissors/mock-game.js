"use strict";

const chai          = require("chai"),
      _             = require("lodash"),
      q             = require("q"),
      MessageType   = require("../../lib/message-type"),
      RpsConclusion = require("../../lib/game-managers/choice-provider/rock-paper-scissors/rps-conclusion");

const assert = chai.assert;

function MockGame($numPlayers, $moves, $expectation) {
  let numPlayers = $numPlayers;
  let moves = $moves;
  let expectation = $expectation;
  let curGame = -1; // Last game that started, 0-indexed
  let players;

  // Essentially promises a conclusion. The promise is resolved
  // when the last game finishes.
  let defConclusion = q.defer();

  function initialize() {
    players = new Array(numPlayers);
    for(let i = 0; i < numPlayers; ++i)
      players[i] = { id: "p" + i };
  }

  function generateActionHandler(rps) {
    return function onAction(action, msg) {
      if(action !== "action") return;

      switch(msg.cmd) {
        case MessageType.RockPaperScissors:
          newGame(rps);
          break;
        case MessageType.RpsConclusion:
          assertConclusion(msg);
      }
    };
  }
  this.generateActionHandler = generateActionHandler;

  function newGame(rps) {
    ++curGame;

    for(let i = 0; i < players.length; ++i) {
      if(moves[curGame][i])
        rps.giveAnswer(players[i], moves[curGame][i]);
    }
  }

  function assertConclusion(msg) {
    try {
      assert.equal(msg.conclusion, expectation[curGame].conclusion,
        "game " + curGame);

      // If we have a winner, then compare it to our expected winner
      switch(msg.conclusion) {
        case RpsConclusion.NextRound:
        case RpsConclusion.Winner:
          assert.equal(msg.winnerId,
            playerId(expectation[curGame].winner),
            "game " + curGame);
      }

      // If this is the last game, resolve our promise
      if(curGame === moves.length - 1) {
        defConclusion.resolve();
      }
    } catch(e) {
      defConclusion.reject(e);
    }
  }
  this.assertConclusion = assertConclusion;

  function playerId(i) {
    return "p" + i;
  }

  Object.defineProperties(this, {
    players: {
      enumerable: true,
      get: function() {
        return _.clone(players);
      }
    },

    qConclusion: {
      enumerable: true,
      get: function() {
        return defConclusion.promise;
      }
    }
  });

  initialize();
  _.fill(arguments, null);
}

module.exports = MockGame;