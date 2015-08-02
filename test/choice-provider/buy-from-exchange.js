"use strict";
/* jshint mocha: true */

const config = require("config").get("dc-server");
config.testing = true;
config.logLevel = "warn";

const chai            = require("chai"),
      sinon           = require("sinon"),
      BuyFromAutoExchangeOption = require("dc-constants").BuyFromAutoExchangeOption,
      BuyFromExchange = require("../../lib/game-managers/choice-provider/buy-from-exchange");

const assert = chai.assert;

describe("BuyFromExchange", function() {
  it("returns the buying player's answer", function(done) {
    let p1 = { id: 1 };
    let p2 = { id: 2 };

    let handler = new BuyFromExchange(p1, false);

    let callbacks = { broadcast: function() {}, toOthers: function() {} };

    // A BuyFromExchangeOption message should be broadcast and
    // then a BuyFromExchangeResult message should be sent to
    // everyone but the buying player
    let cbMock = sinon.mock(callbacks);
    cbMock.expects("broadcast").once();
    cbMock.expects("toOthers").once();

    handler.handleIt(callbacks)
      .done(function(result) {
        assert.equal(result, BuyFromAutoExchangeOption.FourThou);
        done();
      });

    // Player 2 is trying to answer for player 1 --
    // don't let him. Also don't allow player 1 to
    // provide a nonsense option
    handler.giveAnswer(p2, { selection: 4 });
    handler.giveAnswer(p1, { selection: 9999999 });
    handler.giveAnswer(p1, { selection: BuyFromAutoExchangeOption.FourThou });
  });
});