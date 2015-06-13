"use strict";

const MessageType = {
  // Lobby commands
  CreateGame: "create",
  JoinGame: "join",
  ListGames: "list",

  // In-game commands
  Chat: "chat",
  Leave: "leave"
};

module.exports = MessageType;