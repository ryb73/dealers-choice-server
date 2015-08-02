"use strict";

const giveUniqueId = require("give-unique-id"),
      q            = require("q"),
      dcConstants  = require("dc-constants"),
      MessageType  = dcConstants.MessageType;

function PromptOpenLot($player) {
  giveUniqueId(this);
  let self = this;

  let player = $player;
  $player = null;

  let callbacks, deferred;

  function handleIt(cb) {
    callbacks = cb;

    let msg = {
      cmd: MessageType.PromptOpenLot,
      playerId: player.id,
      handlerId: self.id
    };
    callbacks.broadcast("action", msg);

    deferred = q.defer();
    return deferred.promise;
  }
  this.handleIt = handleIt;

  function giveAnswer(answeringPlayer, answer) {
    if(answeringPlayer !== player) return;

    notifyOthers(answer);
    deferred.resolve(answer);
  }
  this.giveAnswer = giveAnswer;

  function notifyOthers(answer) {
    let msg = {
      cmd: MessageType.NotifyOpenLot,
      playerId: player.id,
      openingLot: answer
    };
    callbacks.toOthers(player, "action", msg);
  }
}

module.exports = PromptOpenLot;