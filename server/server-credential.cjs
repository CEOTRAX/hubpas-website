// OAuth tokens only, in server memory. This never caches a user's role or session.
function sharedCredential(base, { now = Date.now } = {}) {
  let cached, pending;
  return {
    getAccessToken() {
      if (cached && cached.expiresAt - now() > 60000)
        return Promise.resolve({
          access_token: cached.token,
          expires_in: Math.floor((cached.expiresAt - now()) / 1000),
        });
      if (!pending)
        pending = Promise.resolve()
          .then(() => base.getAccessToken())
          .then((value) => {
            if (!value.access_token || !(value.expires_in > 0))
              throw new Error("Server OAuth credential unavailable.");
            cached = {
              token: value.access_token,
              expiresAt: now() + value.expires_in * 1000,
            };
            return value;
          })
          .finally(() => {
            pending = null;
          });
      return pending;
    },
  };
}
module.exports = { sharedCredential };
