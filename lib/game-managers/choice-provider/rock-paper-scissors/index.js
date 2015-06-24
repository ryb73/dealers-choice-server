"use strict";

const _              = require("lodash"),
      q              = require("q"),
      toArray        = require("iterator-to-array"),
      SwappableProxy = require("swappable-proxy"),
      MessageType    = require("../../../message-type"),
      RpsMoves       = require("./rps-moves"),
      RpsConclusion  = require("./rps-conclusion"),
      config         = require("config").get("dc-server");

const RESULTS_DELAY = (config.testing) ? 10 : 5000;
const COUNTDOWN_DELAY = (config.testing) ? 10 : 6000;

function RockPaperScissors($game, $players, $winCounter) {
  let game = $game;
  let players = $players || game.players;
  let winCounter = $winCounter || {};
  $game = $players = $winCounter = null;

  let broadcast;
  let deferred;
  let answers = new Map();
  let answerCount = 0;
  let proxy = new SwappableProxy(this);

  function handleIt(bc) {
    broadcast = bc;

    let msg = {
      cmd: MessageType.RockPaperScissors
    };
    broadcast("action", msg);

    // Return a promise for the result. Delay it by 5 seconds so
    // that the client has time to display the winner to the user
    deferred = q.defer();
    return deferred.promise;
  }
  this.handleIt = handleIt;

  function giveAnswer(player, answer) {
    // Make sure the player that answered
    // is actually involved in this match
    if(!_.any(players, "id", player.id))
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

    q.delay(COUNTDOWN_DELAY).then(determineWinner);
  }

  function determineWinner() {
    // This basically works by looking at each player and
    // determining if they got eliminated (e.g. they did
    // rock and someone else did paper). We go until there's
    // exactly one survivor.
    let answerArray = toArray(answers.entries());
    let survivors = _.filter(answerArray, playerSurvived);

    let msg = {
      cmd: MessageType.RpsConclusion,
      answers: answerArray
    };

    if(survivors.length === 1) {
      // survivors is an array of collection entries; [0][0]
      // gives us the key (player ID) for the first (only) entry
      msg.conclusion = winnerWinnerChickenDinner(survivors[0][0]);
      msg.winnerId = survivors[0][0];
    } else if(survivors.length > 1 &&
               survivors.length < players.length) {
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
      .then(function() {
        deferred.resolve(newGame.handleIt(broadcast));
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
      .then(function() {
        deferred.resolve(playerId);
      });

    return RpsConclusion.Winner;
  }

  function getPlayerObject(answerEntry) {
    let playerId = answerEntry[0];
    return _.find(players, "id", playerId);
  }

  function playerSurvived(answerEntry) {
    let move = answerEntry[1];
    let weakness = moveWeakness(move);
    let answerArray = toArray(answers.values());
    return !_.contains(answerArray, weakness);
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

  return proxy.instance;
}

module.exports = RockPaperScissors;