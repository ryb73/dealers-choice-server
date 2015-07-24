"use strict";
/* jshint mocha: true */

const config = require("config").get("dc-server");
config.testing = true;
config.logLevel = "warn";

const chai        = require("chai"),
      sinon       = require("sinon"),
      Replenish   = require("../../lib/game-managers/choice-provider/replenish");

const assert = chai.assert;

describe("Replenish", function() {
  it("returns the replenishing player's answer", function(done) {
    let p1 = { id: 1 };
    let p2 = { id: 2 };

    let handler = new Replenish(p1);

    let callbacks = { broadcast: function() {}, toOthers: function() {} };

    // A ReplenishOption message should be broadcast and
    // then a ReplenishResult message should be sent to
    // everyone but the replenishing player
    let cbMock = sinon.mock(callbacks);
    cbMock.expects("broadcast").once();
    cbMock.expects("toOthers").once();

    handler.handleIt(callbacks)
      .done(function(result) {
        assert.equal(result, 10);
        done();
      });

    // Player 2 is trying to answer for player 1 -- don't let him
    handler.giveAnswer(p2, { selection: 4 });
    handler.giveAnswer(p1, { selection: 10 });
  });
});