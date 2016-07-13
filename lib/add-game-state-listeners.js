"use strict";

let spyback     = require("spyback"),
    MessageType = require("dc-constants").MessageType;

function addGameStateListeners(gameData, callbacks) {
    gameData.dealDcCard = spyback(gameData.dealDcCard, null, ([ player ], dcCard) => {
        callbacks.broadcast("action", {
            cmd: MessageType.DealDcCardToPlayer,
            playerId: player.id,
            dcCard
        });
    });

    gameData.dealCar = spyback(gameData.dealCar, null, ([ player ], car) => {
        callbacks.broadcast("action", {
            cmd: MessageType.DealCarToPlayer,
            playerId: player.id,
            car
        });
    });

    gameData.dealInsurance = spyback(gameData.dealInsurance, null, ([ player ], insurance) => {
        callbacks.broadcast("action", {
            cmd: MessageType.DealInsuranceToPlayer,
            playerId: player.id,
            insurance
        });
    });
}

module.exports = addGameStateListeners;