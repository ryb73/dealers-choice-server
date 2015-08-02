"use strict";

const giveUniqueId = require("give-unique-id"),
      q            = require("q"),
      dcConstants  = require("dc-constants"),
      MessageType  = dcConstants.MessageType;

function PromptForBids($player) {
  giveUniqueId(this);
  let self = this;

  let player = $player;
  $player = null;

  let callbacks, deferred;

  function handleIt(cb) {
    callbacks = cb;

    let msg = {
      cmd: MessageType.PromptForBids,
      playerId: player.id,
      handlerId: self.id
    };
    callbacks.broadcast("action", msg);

    deferred = q.defer();
    return deferred.promise;
  }
  this.handleIt = handleIt;

  function giveAnswer(answeringPlayer, carId) {
    if(answeringPlayer === player) return;

    let car = player.cars.get(carId);
    if(!car) return;

    let result = {
      car: car,
      bidder: answeringPlayer
    };

    deferred.resolve(result);
  }
  this.giveAnswer = giveAnswer;
}

module.exports = PromptForBids;