"use strict";
/* jshint mocha: true */

const config = require("config").get("dc-server");
config.testing = true;
config.logLevel = "warn";

const chai              = require("chai"),
      chaiAsPromised    = require("chai-as-promised"),
      q                 = require("q"),
      MockGame          = require("./mock-game"),
      RpsMoves          = require("../../lib/game-managers/choice-provider/rock-paper-scissors/rps-moves"),
      RpsConclusion     = require("../../lib/game-managers/choice-provider/rock-paper-scissors/rps-conclusion"),
      RockPaperScissors = require("../../lib/game-managers/choice-provider/rock-paper-scissors");

chai.use(chaiAsPromised);
const assert = chai.assert;

describe("RockPaperScissors", function() {
  it("handles a 1-on-1 2 out of 3 game", function() {
    let gameMoves = [
      [ { move: RpsMoves.Rock }, { move: RpsMoves.Rock } ], // game 1
      [ { move: RpsMoves.Rock }, { move: RpsMoves.Paper } ], // game 2
      [ { move: RpsMoves.Rock }, { move: RpsMoves.Scissors } ], // game 3
      [ { move: RpsMoves.Paper }, { move: RpsMoves.Scissors } ] // game 4
    ];

    let expectation = [
      { conclusion: RpsConclusion.DoOver },
      { conclusion: RpsConclusion.NextRound, winner: 1 },
      { conclusion: RpsConclusion.NextRound, winner: 0 },
      { conclusion: RpsConclusion.Winner, winner: 1 }
    ];

    return runGame(gameMoves, 1, expectation);
  });

  it("handles a simple three-player game", function() {
    let gameMoves = [
      [ { move: RpsMoves.Rock },
        { move: RpsMoves.Scissors },
        { move: RpsMoves.Scissors } ]
    ];

    let expectation = [
      { conclusion: RpsConclusion.Winner, winner: 0 }
    ];

    return runGame(gameMoves, 0, expectation);
  });

  it("handles everyone losing in a three-player game", function() {
    let gameMoves = [
      [ { move: RpsMoves.Rock },
        { move: RpsMoves.Paper },
        { move: RpsMoves.Scissors } ],
      [ { move: RpsMoves.Rock },
        { move: RpsMoves.Paper },
        { move: RpsMoves.Rock } ]
    ];

    let expectation = [
      { conclusion: RpsConclusion.DoOver },
      { conclusion: RpsConclusion.Winner, winner: 1 }
    ];

    return runGame(gameMoves, 1, expectation);
  });

  it("handles a showdown", function() {
    let gameMoves = [
      [ { move: RpsMoves.Rock },
        { move: RpsMoves.Scissors },
        { move: RpsMoves.Rock } ],
      [ { move: RpsMoves.Rock },
        null,
        { move: RpsMoves.Paper } ]
    ];

    let expectation = [
      { conclusion: RpsConclusion.Showdown },
      { conclusion: RpsConclusion.Winner, winner: 2 }
    ];

    return runGame(gameMoves, 2, expectation);
  });
});

function runGame(gameMoves, winner, expectation) {
  let game = new MockGame(gameMoves[0].length, gameMoves, expectation);
  let rps = new RockPaperScissors(game);
  let onAction = game.generateActionHandler(rps);

  let qWinnerTest = assert.eventually
    .equal(rps.handleIt(onAction), game.players[winner].id);

  return q.all([ qWinnerTest, game.qConclusion ]);
}