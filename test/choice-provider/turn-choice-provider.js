"use strict";
/* jshint mocha: true */

const config = require("config").get("dc-server");
config.testing = true;
config.logLevel = "warn";

const chai               = require("chai"),
      dcEngine           = require("dc-engine"),
      Player             = dcEngine.Player,
      DcCard             = dcEngine.DcCard,
      dcConstants        = require("dc-constants"),
      MessageType        = dcConstants.MessageType,
      TurnChoice         = dcConstants.TurnChoice,
      TurnChoiceProvider = require("../../lib/game-managers/choice-provider/turn-choice-provider");

const assert = chai.assert;

describe("TurnChoiceProvider", function() {
  it("if playing a card, announces the card", function() {
    let player = new Player(1000);
    let dcCard = new DcCard();
    dcCard.name = "Test Card";
    player.gainDcCard(dcCard);

    let callbacks = {
      broadcast: function() {},
      toOthers: function(p, action, msg) {
        assert.equal(p, player);
        assert.equal(msg.cmd, MessageType.NotifyTurnChoice);
        assert.equal(msg.selection, TurnChoice.DcCard);
        assert.equal(msg.cardId, dcCard.id);
      }
    };

    let choiceProvider = new TurnChoiceProvider(player);
    let qResult = choiceProvider.handleIt(callbacks);
    choiceProvider.giveAnswer(player, {
      selection: TurnChoice.DcCard,
      cardId: dcCard.id
    });

    return qResult;
  });
});