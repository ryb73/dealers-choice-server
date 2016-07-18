"use strict";

const q              = require("q"),
      mockDeckConfig = require("dc-test").mockDeckConfig;

module.exports = {
  "dc-server": {
    port: 5000,
    facebook: {
      appId: "409903325878723",
      appSecret: "e6c47409dfbf573628c9d0aafffd3d25"
    },

    testing: true,
    logLevel: "warn",
    deckConfig: mockDeckConfig(100, 100, 100),
    validateUserId: () => q(true)
  }
};