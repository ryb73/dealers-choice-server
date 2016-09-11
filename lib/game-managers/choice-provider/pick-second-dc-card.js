"use strict";

const giveUniqueId = require("give-unique-id"),
      q            = require("q"),
      dcConstants  = require("dc-constants"),
      MessageType  = dcConstants.MessageType;

function PickSecondDcCard($player) {
  giveUniqueId(this);
  let self = this;

  let player = $player;
  $player = null;

  let callbacks, deferred;

  function handleIt(cb) {
    callbacks = cb;

    let msg = {
      cmd: MessageType.AllowSecondDcCard,
      handlerId: self.id
    };
    callbacks.toYou(player, "action", msg);

    deferred = q.defer();
    return deferred.promise;
  }
  this.handleIt = handleIt;

  function giveAnswer(answeringPlayer, answer) {
    console.log("giveAnswer", answer);
    if(answeringPlayer !== player) return;
    if(!validateAnswer(answer)) return;


    if(answer.skip) {
      deferred.resolve(null);
    } else {
      deferred.resolve(player.dcCards[answer.cardId]);
    }
  }
  this.giveAnswer = giveAnswer;

  function validateAnswer(answer) {
    return answer.skip || answer.cardId in player.dcCards;
  }
}

module.exports = PickSecondDcCard;