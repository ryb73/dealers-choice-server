"use strict";

const giveUniqueId = require("give-unique-id"),
      q            = require("q"),
      dcEngine     = require("dc-engine"),
      Offer        = dcEngine.Offer,
      dcConstants  = require("dc-constants"),
      MessageType  = dcConstants.MessageType;

function PromptForBids($seller) {
  giveUniqueId(this);
  let self = this;

  let seller = $seller;
  $seller = null;

  let callbacks, deferred;

  function handleIt(cb) {
    callbacks = cb;

    let msg = {
      cmd: MessageType.PromptForBids,
      playerId: seller.id,
      handlerId: self.id
    };
    callbacks.broadcast("action", msg);

    deferred = q.defer();
    return deferred.promise;
  }
  this.handleIt = handleIt;

  function giveAnswer(answeringPlayer, carId) {
    if(answeringPlayer === seller) return;

    let car = seller.cars.get(carId);
    if(!car) return;

    let result = new Offer(answeringPlayer, seller, car, 100);
    deferred.resolve(result);
  }
  this.giveAnswer = giveAnswer;
}

module.exports = PromptForBids;