"use strict";
/* jshint mocha: true */

const config = require("config").get("dc-server");
config.testing = true;
config.logLevel = "warn";

const chai           = require("chai"),
      sinon          = require("sinon"),
      dcEngine       = require("dc-engine"),
      Player         = dcEngine.Player,
      PromptForBids  = require("../../lib/game-managers/choice-provider/prompt-for-bids");

const assert = chai.assert;

describe("PromptForBids", function() {
  it("takes the first player's bid", function() {
    let player1 = new Player(1000);
    let player2 = new Player(1000);
    let player3 = new Player(1000);

    let car = { id: 1 };
    player1.buyCar(car, 0);

    let callbacks = { broadcast: function() {} };
    let mockCb = sinon.mock(callbacks);
    mockCb.expects("broadcast").once();

    let choiceProvider = new PromptForBids(player1);
    let qResult = choiceProvider.handleIt(callbacks);

    // Player 1's bid should be rejected as the seller
    // Player 2's first bid is a non-existent car
    // Player 3's should then be accepted
    choiceProvider.giveAnswer(player1, 1);
    choiceProvider.giveAnswer(player2, 2);
    choiceProvider.giveAnswer(player3, 1);
    choiceProvider.giveAnswer(player2, 1);

    return qResult.then(function(result) {
      assert.equal(result.car, car);
      assert.equal(result.buyer, player3);
      assert.equal(result.seller, player1);
      mockCb.verify();
    });
  });
});