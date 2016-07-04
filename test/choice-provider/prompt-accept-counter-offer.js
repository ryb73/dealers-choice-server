"use strict";
/* jshint mocha: true */

const chai           = require("chai"),
      chaiAsPromised = require("chai-as-promised"),
      sinon          = require("sinon"),
      dcEngine       = require("dc-engine"),
      Player         = dcEngine.Player,
      PromptAcceptCounterOffer = require("../../lib/game-managers/choice-provider/prompt-accept-counter-offer");

chai.use(chaiAsPromised);
const assert = chai.assert;

describe("PromptAcceptCounterOffer", function() {
  it("takes player's answer", function() {
    let callbacks = { toOthers: function() {} };
    let mockCb = sinon.mock(callbacks);
    mockCb.expects("toOthers").twice();

    let offer = {
      seller: new Player(1000),
      buyer: new Player(1000),
      amount: 100,
      car: {}
    };

    let choiceProvider = new PromptAcceptCounterOffer(offer);
    let qResult = choiceProvider.handleIt(callbacks);
    choiceProvider.giveAnswer(offer.buyer, true);

    return qResult.then(function(result) {
      assert.equal(result, true);
      mockCb.verify();
    });
  });
});