require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const opaque = require("@serenity-kit/opaque");

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  user: "postgres",
  password: process.env.PG_PASSWORD,
  host: "localhost",
  port: 5432,
  database: "axion",
});

// Holds in-progress login attempts between /login/start and /login/finish.
// Fine for local single-instance development; a production version would
// use a keyed, expiring store instead of a plain in-memory Map.
const pendingLogins = new Map();

async function start() {
  await opaque.ready;

  const serverSetup = process.env.OPAQUE_SERVER_SETUP;
  if (!serverSetup) {
    throw new Error("OPAQUE_SERVER_SETUP missing from .env — did you run generate-setup.js?");
  }

  app.post("/register/start", (req, res) => {
    const { username, registrationRequest } = req.body;
    const { registrationResponse } = opaque.server.createRegistrationResponse({
      serverSetup,
      userIdentifier: username,
      registrationRequest,
    });
    res.json({ registrationResponse });
  });

  app.post("/register/finish", async (req, res) => {
    const { username, registrationRecord } = req.body;
    try {
      await pool.query(
        "INSERT INTO users (username, registration_record) VALUES ($1, $2)",
        [username, registrationRecord]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err.message);
      res.status(400).json({ success: false, error: "Username may already be taken." });
    }
  });

  app.post("/login/start", async (req, res) => {
    const { username, startLoginRequest } = req.body;
    const result = await pool.query(
      "SELECT registration_record FROM users WHERE username = $1",
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Unknown user." });
    }
    const registrationRecord = result.rows[0].registration_record;

    const { serverLoginState, loginResponse } = opaque.server.startLogin({
      serverSetup,
      userIdentifier: username,
      registrationRecord,
      startLoginRequest,
    });

    pendingLogins.set(username, serverLoginState);
    res.json({ loginResponse });
  });

  app.post("/login/finish", (req, res) => {
    const { username, finishLoginRequest } = req.body;
    const serverLoginState = pendingLogins.get(username);
    if (!serverLoginState) {
      return res.status(400).json({ error: "No login in progress for this user." });
    }
    pendingLogins.delete(username);

    try {
      opaque.server.finishLogin({ finishLoginRequest, serverLoginState });
      // In a real deployment: derive a session token from the resulting
      // session key and set it as an httpOnly cookie here.
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: "Login failed." });
    }
  });

  app.listen(3000, () => console.log("AXION auth server listening on http://localhost:3000"));
}

start();