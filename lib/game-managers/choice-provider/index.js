"use strict";

const config             = require("config").get("dc-server"),
      assert             = require("chai").assert,
      rpbLogging         = require("rpb-logging"),
      log                = rpbLogging("dc-server", config.logLevel),
      RockPaperScissors  = require("./rock-paper-scissors"),
      BuyFromExchange    = require("./buy-from-exchange"),
      TurnChoiceProvider = require("./turn-choice-provider"),
      PromptOpenLot      = require("./prompt-open-lot"),
      PromptForBids      = require("./prompt-for-bids"),
      HandleBidding      = require("./handle-bidding"),
      DecideFinalOffer   = require("./decide-final-offer"),
      ChooseOwnCar       = require("./choose-own-car"),
      PickSecondDcCard   = require("./pick-second-dc-card");

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

  function doBuyFromExchange(player, isReplenish) {
    return handleGeneric(new BuyFromExchange(player, isReplenish));
  }
  this.doBuyFromExchange = doBuyFromExchange;

  function getTurnChoice(player) {
    return handleGeneric(new TurnChoiceProvider(player));
  }
  this.getTurnChoice = getTurnChoice;

  function allowOpenLot(player) {
    return handleGeneric(new PromptOpenLot(player));
  }
  this.allowOpenLot = allowOpenLot;

  function allowBids(player) {
    return handleGeneric(new PromptForBids(player));
  }
  this.allowBids = allowBids;

  function doBidding(offer) {
    return handleGeneric(new HandleBidding(offer));
  }
  this.doBidding = doBidding;

  function decideFinalOffer(finalBid) {
    return handleGeneric(new DecideFinalOffer(finalBid));
  }
  this.decideFinalOffer = decideFinalOffer;

  function proposeCounterOffer(offer) {
    return handleGeneric(new ProposeCounterOffer(offer));
  }
  this.proposeCounterOffer = proposeCounterOffer;

  function chooseOwnCar(player) {
    return handleGeneric(new ChooseOwnCar(player));
  }
  this.chooseOwnCar = chooseOwnCar;

  function pickSecondDcCard(player) {
    return handleGeneric(new PickSecondDcCard(player));
  }
  this.pickSecondDcCard = pickSecondDcCard;

  function handleGeneric(handler) {
    // Create handler and store reference to it so that
    // it can be referenced later. There could be multiple
    // concurrent choices (or a client could be behind and
    // try to answer an old one) so clients need to specifically
    // reference the choice they're answering
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