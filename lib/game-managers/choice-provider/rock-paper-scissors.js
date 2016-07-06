"use strict";

const _              = require("lodash"),
      q              = require("q"),
      toArray        = require("iterator-to-array"),
      SwappableProxy = require("swappable-proxy"),
      nodeUuid       = require("node-uuid"),
      dcConstants    = require("dc-constants"),
      MessageType    = dcConstants.MessageType,
      RpsMoves       = dcConstants.RpsMoves,
      RpsConclusion  = dcConstants.RpsConclusion,
      config         = require("config").get("dc-server");

const RESULTS_DELAY = (config.testing) ? 10 : 6000;
const COUNTDOWN_DELAY = (config.testing) ? 10 : 3000;

function RockPaperScissors($game, $players, $winCounter) {
  let proxy = new SwappableProxy(this);

  let game = $game,
      players = $players || game.players,
      winCounter = $winCounter || {};
  $game = $players = $winCounter = null;

  let callbacks,
      broadcast,
      deferred,
      answers = new Map(),
      answerCount = 0,
      id = nodeUuid.v1();

  // Returns a promise for the ID of the player
  // who won the game
  function handleIt(cb) {
    callbacks = cb;
    broadcast = callbacks.broadcast;

    let msg = {
      cmd: MessageType.RockPaperScissors,
      handlerId: id
    };
    broadcast("action", msg);

    // Return a promise for the result
    deferred = q.defer();
    return deferred.promise;
  }
  this.handleIt = handleIt;

  function giveAnswer(player, answer) {
    // Make sure the player that answered
    // is actually involved in this match
    if(!_.some(players, { id: player.id }))
      return;

    answers.set(player.id, answer.move);
    if(++answerCount === players.length)
      beginCountdown();
  }
  this.giveAnswer = giveAnswer;

  // This rock-paper-scissors game is SERIOUS
  function beginCountdown() {
    let msg = {
      cmd: MessageType.RpsCountdown
    };
    broadcast("action", msg);

    q.delay(COUNTDOWN_DELAY).done(determineWinner);
  }

  function determineWinner() {
    // This basically works by looking at each player and
    // determining if they got eliminated (e.g. they did
    // rock and someone else did paper). We go until there's
    // exactly one survivor.
    let answerArray = getAnswersArray();
    let survivors = _.filter(answerArray, playerSurvived);

    let msg = {
      cmd: MessageType.RpsConclusion,
      answers: answerArray,
      survivors: _.map(survivors, "playerId")
    };

    if(survivors.length === 1) {
      msg.conclusion = winnerWinnerChickenDinner(survivors[0].playerId);
      msg.winnerId = survivors[0].playerId;
    } else if(survivors.length > 1 && survivors.length < players.length) {
      // Some players have been eliminated
      msg.survivingPlayers = survivors.map(getPlayerObject);
      restartGame(msg.survivingPlayers);
      msg.conclusion = RpsConclusion.Showdown;
    } else {
      // Everyone got got (or no one did) -- just do it over
      restartGame(players);
      msg.conclusion = RpsConclusion.DoOver;
    }

    broadcast("action", msg);
  }

  // Starts a new game of RPS with the given array of players.
  // A delay is added so that the client has time to show the
  // results to the user.
  function restartGame(players) {
    // Replace the current instance with a new instance
    let newGame = new RockPaperScissors(game, players, winCounter);
    proxy.swap(newGame);

    q.delay(RESULTS_DELAY)
      .done(function() {
        deferred.resolve(newGame.handleIt(callbacks));
      });
  }

  function winnerWinnerChickenDinner(playerId) {
    if(game.players.length === 2) {
      // special case: when there are only two players, we do
      // two out of three (again, this is serious)
      winCounter[playerId] = (winCounter[playerId] + 1) || 1;
      if(winCounter[playerId] < 2) {
        // No winner yet
        restartGame(players);
        return RpsConclusion.NextRound;
      }
      // If someone won, then fall through to the general case
    }

    q.delay(RESULTS_DELAY)
      .done(function() {
        deferred.resolve(game.getPlayerIndexById(playerId));
      });

    return RpsConclusion.Winner;
  }

  function getAnswersArray() {
    return toArray(answers.entries()).map(function(answerEntry) {
      return {
        playerId: answerEntry[0],
        move: answerEntry[1]
      };
    });
  }

  function getPlayerObject(answer) {
    return _.find(players, { id: answer.playerId });
  }

  function playerSurvived(answer) {
    let weakness = moveWeakness(answer.move);
    let answerArray = toArray(answers.values());
    return !_.includes(answerArray, weakness);
  }

  function moveWeakness(move) {
    switch(move) {
      case RpsMoves.Rock:
        return RpsMoves.Paper;
      case RpsMoves.Paper:
        return RpsMoves.Scissors;
      case RpsMoves.Scissors:
        return RpsMoves.Rock;
    }
  }

  Object.defineProperties(this, {
    id: {
      enumerable: true,
      get: function() {
        return id;
      }
    }
  });

  return proxy.instance;
}

module.exports = RockPaperScissors;