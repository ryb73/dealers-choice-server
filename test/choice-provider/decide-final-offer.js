"use strict";
/* jshint mocha: true */

const chai              = require("chai"),
      dcEngine          = require("dc-engine"),
      Player            = dcEngine.Player,
      Offer             = dcEngine.Offer,
      DecideFinalOffer  = require("../../lib/game-managers/choice-provider/decide-final-offer");

const assert = chai.assert;

describe("DecideFinalOffer", function() {
  it("returns null if the offer is accepted", function() {
    let seller = new Player(1000);
    let buyer = new Player(1000);
    let car = { id: 1 };
    let finalBid = new Offer(buyer, seller, car, 100);

    let callbacks = { broadcast: function() {} };

    let choiceProvider = new DecideFinalOffer(finalBid);
    let qResult = choiceProvider.handleIt(callbacks);
    choiceProvider.giveAnswer(seller, {
      accept: true
    });

    return qResult.then(function(result) {
      assert.isNull(result);
    });
  });
});