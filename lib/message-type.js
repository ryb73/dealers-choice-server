"use strict";

const MessageType = {
  // Lobby commands
  CreateGame: "create",
  JoinGame: "join",
  ListGames: "list",

  // In-game commands
  Chat: "chat",
  Leave: "leave",
  Choice: "choice",

  // S2C Commands
  RockPaperScissors: "rps",
  RpsCountdown: "rpsCountdown",
  RpsConclusion: "rpsConclusion",

  ReplenishOption: "replenish"
};

module.exports = MessageType;