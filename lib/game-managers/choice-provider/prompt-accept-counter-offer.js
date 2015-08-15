"use strict";

const giveUniqueId = require("give-unique-id"),
      q            = require("q"),
      dcConstants  = require("dc-constants"),
      MessageType  = dcConstants.MessageType;

function PromptAcceptCounterOffer($offer) {
  giveUniqueId(this);
  let self = this;

  let seller = $offer.seller,
      buyer  = $offer.buyer,
      offer  = $offer;
  $offer = null;

  let callbacks, deferred;

  function handleIt(cb) {
    callbacks = cb;

    let msg = {
      cmd: MessageType.PromptAcceptCounterOffer,
      offer: offer,
      handlerId: self.id
    };
    callbacks.toOthers(seller, "action", msg);

    deferred = q.defer();
    return deferred.promise;
  }
  this.handleIt = handleIt;

  function giveAnswer(answeringPlayer, answer) {
    if(answeringPlayer !== buyer) return;

    notifyOthers(answer);
    deferred.resolve(answer);
  }
  this.giveAnswer = giveAnswer;

  function notifyOthers(answer) {
    let msg = {
      cmd: MessageType.NotifyAcceptedOffer,
      buyerId: buyer.id,
      acceptedOffer: answer
    };
    callbacks.toOthers(buyer, "action", msg);
  }
}

module.exports = PromptAcceptCounterOffer;