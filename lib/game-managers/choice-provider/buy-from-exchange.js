"use strict";

const giveUniqueId = require("give-unique-id"),
      q            = require("q"),
      dcConstants  = require("dc-constants"),
      MessageType  = dcConstants.MessageType,
      BuyFromAutoExchangeOption = dcConstants.BuyFromAutoExchangeOption;

function BuyFromExchange($player, $isReplenish) {
  giveUniqueId(this);
  let self = this;

  let player = $player,
      isReplenish = $isReplenish;
  $player = $isReplenish = null;

  let callbacks, deferred;

  function handleIt(cb) {
    callbacks = cb;

    let msg = {
      cmd: MessageType.BuyFromExchangeOption,
      playerId: player.id,
      handlerId: self.id,
      isReplenish: isReplenish
    };
    callbacks.broadcast("action", msg);

    deferred = q.defer();
    return deferred.promise;
  }
  this.handleIt = handleIt;

  function giveAnswer(answeringPlayer, answer) {
    if(answeringPlayer !== player) return; // hack attempt?
    if(!validateSelection(answer.selection)) return;

    notifyOthers(answer.selection);
    deferred.resolve(answer.selection);
  }
  this.giveAnswer = giveAnswer;

  function notifyOthers(selection) {
    let msg = {
      cmd: MessageType.BuyFromExchangeResult,
      selection: selection
    };
    callbacks.toOthers(player, "action", msg);
  }

  function validateSelection(selection) {
    return selection === BuyFromAutoExchangeOption.FourThou ||
      selection === BuyFromAutoExchangeOption.ListPrice;
  }
}

module.exports = BuyFromExchange;