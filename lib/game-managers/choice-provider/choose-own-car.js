"use strict";

const giveUniqueId = require("give-unique-id"),
      q            = require("q"),
      dcConstants  = require("dc-constants"),
      MessageType  = dcConstants.MessageType;

function ChooseOwnCar($player) {
  giveUniqueId(this);
  let self = this;

  let player = $player;
  $player = null;

  let callbacks, deferred;

  function handleIt(cb) {
    callbacks = cb;

    let msg = {
      cmd: MessageType.ChooseOwnCar,
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

    deferred.resolve(player.cars[answer.carId]);
  }
  this.giveAnswer = giveAnswer;

  function validateAnswer(answer) {
    return answer.carId in player.cars;
  }
}

module.exports = ChooseOwnCar;