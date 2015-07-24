"use strict";

const giveUniqueId = require("give-unique-id"),
      q            = require("q"),
      _            = require("lodash"),
      dcConstants  = require("dc-constants"),
      MessageType  = dcConstants.MessageType,
      TurnChoice   = dcConstants.TurnChoice;

function TurnChoiceProvider($player) {
  giveUniqueId(this);
  let self = this;

  let player = $player;
  $player = null;

  let callbacks, deferred;

  function handleIt(cb) {
    callbacks = cb;

    let msg = {
      cmd: MessageType.GetTurnChoice,
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
    if(!validateSelection(answer.selection)) return;
  }
  this.giveAnswer = giveAnswer;

  function validateSelection(selection) {
    return _.contains(TurnChoice, selection);
  }
}

module.exports = TurnChoiceProvider;