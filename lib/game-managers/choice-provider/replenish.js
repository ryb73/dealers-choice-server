"use strict";

const giveUniqueId = require("give-unique-id"),
      q            = require("q"),
      dcConstants  = require("dc-constants"),
      MessageType  = dcConstants.MessageType,
      BuyFromAutoExchangeOption = dcConstants.BuyFromAutoExchangeOption;

function Replenish($player) {
  giveUniqueId(this);
  let self = this;

  let player = $player;
  $player = null;

  let callbacks, deferred;

  function handleIt(cb) {
    callbacks = cb;

    let msg = {
      cmd: MessageType.ReplenishOption,
      playerId: player.id,
      handlerId: self.id
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
      cmd: MessageType.ReplenishResult,
      selection: selection
    };
    callbacks.toOthers(player, "action", msg);
  }

  function validateSelection(selection) {
    return selection === BuyFromAutoExchangeOption.FourThou ||
      selection === BuyFromAutoExchangeOption.ListPrice;
  }
}

module.exports = Replenish;