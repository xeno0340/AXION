const opaque = require("@serenity-kit/opaque");

opaque.ready.then(() => {
  const serverSetup = opaque.server.createSetup();
  console.log(serverSetup);
});