const opaque = require("@serenity-kit/opaque");

async function main() {
  await opaque.ready;

  // --- Server generates its long-term setup (do this once, ever, per deployment) ---
  const serverSetup = opaque.server.createSetup();
  console.log("Server setup created (this would be stored securely server-side):");
  console.log(serverSetup);

  // --- Registration (signup) ---
  const username = "abdul_rahman";
  const password = "correct-horse-battery-staple";

  const { clientRegistrationState, registrationRequest } =
    opaque.client.startRegistration({ password });

  const { registrationResponse } = opaque.server.createRegistrationResponse({
    serverSetup,
    userIdentifier: username,
    registrationRequest,
  });

  const { registrationRecord } = opaque.client.finishRegistration({
    clientRegistrationState,
    registrationResponse,
    password,
  });

  console.log("\nRegistration complete. This 'registrationRecord' (the envelope) is what the server stores:");
  console.log(registrationRecord);
  console.log("\nNotice: the password itself never appears anywhere above except inside our own script's memory.");

  // --- Login ---
  const { clientLoginState, startLoginRequest } =
    opaque.client.startLogin({ password });

  const loginResponse = opaque.server.startLogin({
    serverSetup,
    userIdentifier: username,
    registrationRecord,
    startLoginRequest,
  });

  const loginResult = opaque.client.finishLogin({
    clientLoginState,
    loginResponse: loginResponse.loginResponse,
    password,
  });

  if (!loginResult) {
    console.log("\nLogin FAILED — wrong password or corrupted exchange.");
    return;
  }

  const { finishLoginRequest, sessionKey: clientSessionKey } = loginResult;

  const serverLoginResult = opaque.server.finishLogin({
    finishLoginRequest,
    serverLoginState: loginResponse.serverLoginState,
  });

  console.log("\nLogin successful.");
  console.log("Client-derived session key:", clientSessionKey);
  console.log("Server-derived session key:", serverLoginResult.sessionKey);
  console.log("\nThese two session keys should match exactly, even though the password was never transmitted.");
}

main();