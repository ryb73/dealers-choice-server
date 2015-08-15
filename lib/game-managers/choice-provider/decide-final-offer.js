"use strict";

const giveUniqueId = require("give-unique-id"),
      q            = require("q"),
      dcEngine     = require("dc-engine"),
      Offer        = dcEngine.Offer,
      dcConstants  = require("dc-constants"),
      MessageType  = dcConstants.MessageType;

function DecideFinalOffer($finalBid) {
  giveUniqueId(this);
  let self = this;

  let seller = $finalBid.seller,
      buyer  = $finalBid.buyer,
      car    = $finalBid.car,
      amount = $finalBid.amount;
  $finalBid = null;

  let callbacks, deferred;

  function handleIt(cb) {
    callbacks = cb;

    let msg = {
      cmd: MessageType.DecideFinalOffer,
      sellerId: seller.id,
      buyerId: buyer.id,
      carId: car.id,
      amount: amount,
      handlerId: self.id
    };
    callbacks.broadcast("action", msg);

    deferred = q.defer();
    return deferred.promise;
  }
  this.handleIt = handleIt;

  function giveAnswer(answeringPlayer, answer) {
    if(answeringPlayer !== seller) return;

    if(answer.accept)
      deferred.resolve(null); // null means offer was accepted

    let offer = new Offer(buyer, seller, car, answer.counterOffer);
    deferred.resolve(offer);
  }
  this.giveAnswer = giveAnswer;
}

module.exports = DecideFinalOffer;