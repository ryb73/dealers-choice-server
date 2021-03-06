"use strict";
/* jshint mocha: true */

const chai               = require("chai"),
      sinon              = require("sinon"),
      dcEngine           = require("dc-engine"),
      Player             = dcEngine.Player,
      MockCard           = require("dc-test").MockCard,
      dcConstants        = require("dc-constants"),
      TurnChoice         = dcConstants.TurnChoice,
      TurnChoiceProvider = require("../../lib/game-managers/choice-provider/turn-choice-provider");

const assert = chai.assert;

describe("TurnChoiceProvider", function() {
  it("if playing a card, returns the card", function() {
    let player = new Player(1000);
    let dcCard = new MockCard();
    player.gainDcCard(dcCard);

    let callbacks = { broadcast: function() {}, toOthers: function() {} };
    let mockCb = sinon.mock(callbacks);
    mockCb.expects("broadcast").once();
    mockCb.expects("toOthers").once();

    let choiceProvider = new TurnChoiceProvider(player);
    let qResult = choiceProvider.handleIt(callbacks);
    choiceProvider.giveAnswer(player, {
      selection: TurnChoice.DcCard,
      cardId: dcCard.id
    });

    return qResult
      .then(function(result) {
        assert.equal(result.choice, TurnChoice.DcCard);
        assert.equal(result.card, dcCard);
      });
  });
});
