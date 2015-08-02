"use strict";

const giveUniqueId = require("give-unique-id"),
      q            = require("q"),
      dcConstants  = require("dc-constants"),
      MessageType  = dcConstants.MessageType,
      dcEngine     = require("dc-engine"),
      Offer        = dcEngine.Offer,
      config       = require("config").get("dc-server");

const RESULTS_DELAY  = (config.testing) ? 10 : 5000,
      TIMER_DURATION = (config.testing) ? 100 : 7000;

function PerformBidding($initialOffer) {
  giveUniqueId(this);
  let self = this;

  let seller     = $initialOffer.seller,
      car        = $initialOffer.car,
      buyer      = $initialOffer.buyer, // buyer and currentBid
      currentBid = $initialOffer.amount; // are mutable
  $initialOffer = null;

  let callbacks, deferred, timerId;

  function handleIt(cb) {
    callbacks = cb;

    let msg = {
      cmd: MessageType.BeginBidding,
      carId: car.id,
      sellerId: seller.id,
      initialBid: {
        bidderId: buyer.id,
        amount: currentBid
      },
      handlerId: self.id
    };
    callbacks.broadcast("action", msg);

    deferred = q.defer();
    resetTimer();
    return deferred.promise;
  }
  this.handleIt = handleIt;

  function resetTimer() {
    if(timerId)
      clearTimeout(timerId);
    timerId = setTimeout(finishBidding, TIMER_DURATION);
  }

  function finishBidding() {
    notify(true);
    let offer = new Offer(buyer, seller, car, currentBid);

    q.delay(RESULTS_DELAY) // wait a little bit for players to
      .done(function() {   // see the final bid
        deferred.resolve(offer);
      });
  }

  function notify(finished) {
    let msg = {
      cmd: (finished) ? MessageType.BiddingFinished :
                        MessageType.NewHighBidder,
      buyerId: buyer.id,
      amount: currentBid
    };
    callbacks.broadcast("action", msg);
  }

  // answer is the bid amount
  function giveAnswer(answeringPlayer, answer) {
    if(answeringPlayer === seller) return;
    if(answer <= currentBid) return;

    buyer = answeringPlayer;
    currentBid = answer;

    resetTimer();
    notify(false);
  }
  this.giveAnswer = giveAnswer;
}

module.exports = PerformBidding;