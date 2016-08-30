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

    gameData.players.forEach(addPlayerListeners.bind(null, callbacks));
}

function addPlayerListeners(callbacks, player) {
    player.sellCarToBank = spyback(player.sellCarToBank, null, ([ car, amount ]) => {
        callbacks.broadcast("action", {
            cmd: MessageType.CarSoldToBank,
            playerId: player.id,
            carId: car.id,
            amount
        });
    });
}

module.exports = addGameStateListeners;