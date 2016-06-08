"use strict";

let spyback     = require("spyback"),
    MessageType = require("dc-constants").MessageType;

function addGameStateListeners(gameData, callbacks) {
    gameData.dealDcCard = spyback(gameData.dealDcCard, null, ([ player ], dcCard) => {
        callbacks.toAll(player, "action", {
            cmd: MessageType.DealDcCardToPlayer,
            playerId: player.id,
            dcCard
        });
    });
}

module.exports = addGameStateListeners;