"use strict";

const config = require("config").get("dc-server.facebook"),
      FB     = require("fb"),
      q      = require("q");

module.exports = function validateUserId(userId, accessToken) {
  let appAccessToken = config.appId + "|" + config.appSecret;

  let deferred = q.defer();

  FB.api("/debug_token",
    {
      input_token: accessToken,
      access_token: appAccessToken,
    },
    function(response) {
      if(response.error) {
        deferred.reject(response.error);
        return;
      }

      let isValid = response.data.is_valid &&
                    userId === response.data.user_id;
      deferred.resolve(isValid);
    }
  );

  return deferred.promise;
};