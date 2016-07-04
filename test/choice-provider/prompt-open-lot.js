"use strict";
/* jshint mocha: true */

const chai           = require("chai"),
      chaiAsPromised = require("chai-as-promised"),
      sinon          = require("sinon"),
      dcEngine       = require("dc-engine"),
      Player         = dcEngine.Player,
      PromptOpenLot  = require("../../lib/game-managers/choice-provider/prompt-open-lot");

chai.use(chaiAsPromised);
const assert = chai.assert;

describe("PromptOpenLot", function() {
  it("takes player's answer", function() {
    let player = new Player(1000);

    let callbacks = { broadcast: function() {}, toOthers: function() {} };
    let mockCb = sinon.mock(callbacks);
    mockCb.expects("broadcast").once();
    mockCb.expects("toOthers").once();

    let choiceProvider = new PromptOpenLot(player);
    let qResult = choiceProvider.handleIt(callbacks);
    choiceProvider.giveAnswer(player, true);

    return qResult.then(function(result) {
      assert.equal(result, true);
      mockCb.verify();
    });
  });
});