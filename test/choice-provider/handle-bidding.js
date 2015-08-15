"use strict";
/* jshint mocha: true */

const config = require("config").get("dc-server");
config.testing = true;
config.logLevel = "warn";

const chai           = require("chai"),
      sinon          = require("sinon"),
      dcEngine       = require("dc-engine"),
      Player         = dcEngine.Player,
      Car            = dcEngine.Car,
      Offer          = dcEngine.Offer,
      dcConstants    = require("dc-constants"),
      MessageType    = dcConstants.MessageType,
      HandleBidding  = require("../../lib/game-managers/choice-provider/handle-bidding");

const assert = chai.assert;

describe("HandleBidding", function() {
  it("takes the highest bid", function() {
    let player1 = new Player(1000);
    let player2 = new Player(1000);
    let player3 = new Player(1000);

    let car = new Car(1, 0);
    player1.buyCar(car, 0);

    let callbacks = {
      broadcast: function(action, msg) {
        if(msg.cmd === MessageType.BiddingFinished) {
          assert.equal(msg.buyerId, player3.id);
          assert.equal(msg.amount, 10000);
        }
      }
    };
    let broadcastSpy = sinon.spy(callbacks, "broadcast");

    let initialOffer = new Offer(player2, player1, car, 100);

    let choiceProvider = new HandleBidding(initialOffer);
    let qResult = choiceProvider.handleIt(callbacks);

    choiceProvider.giveAnswer(player3, 500);
    choiceProvider.giveAnswer(player2, 1000);
    choiceProvider.giveAnswer(player3, 2000);
    choiceProvider.giveAnswer(player2, 5000);
    choiceProvider.giveAnswer(player3, 10000);

    return qResult.then(function(result) {
      assert.equal(result.car, car);
      assert.equal(result.buyer, player3);
      assert.equal(result.seller, player1);
      assert.equal(result.amount, 10000);

      // One initial msg + 5 bids + final msg = 7
      assert.equal(broadcastSpy.callCount, 7);
    });
  });
});