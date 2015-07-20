"use strict";

const giveUniqueId = require("give-unique-id");

function Replenish($game, $player) {
  giveUniqueId(this);

  let game = $game;
  let player = $player;
  $game = $player = null;

  function handleIt(bc) {

  }
}

module.exports = Replenish;