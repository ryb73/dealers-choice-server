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
    if(!validateAnswer(answer)) return;

    let choiceData = {
      choice: answer.selection
    };

    if(answer.selection === TurnChoice.DcCard) {
      choiceData.card = player.dcCards.get(answer.cardId);
    }

    notifyOthers(answer);

    deferred.resolve(choiceData);
  }
  this.giveAnswer = giveAnswer;

  function notifyOthers(answer) {
    let msg = {
      cmd: MessageType.NotifyTurnChoice,
      playerId: player.id,
      selection: answer.selection,
      cardId: answer.cardId
    };
    callbacks.toOthers(player, "action", msg);
  }

  function validateAnswer(answer) {
    if(!_.contains(TurnChoice, answer.selection)) return false;
    if(answer.selection === TurnChoice.DcCard &&
       !player.dcCards.has(answer.cardId)) return false;

    return true;
  }
}

module.exports = TurnChoiceProvider;