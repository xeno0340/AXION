require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());

const pool = new Pool({
  user: "postgres",
  password: process.env.PG_PASSWORD,
  host: "localhost",
  port: 5432,
  database: "axion_baseline",
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "Username and password required." });
  }

  // This is the deliberately "conventional" step: the server receives the
  // actual plaintext password here, hashes it, and only the hash is stored.
  // That's the industry-standard approach — and exactly the thing that
  // still fails once the database itself is stolen, which is the whole
  // point of building this system to compare against.
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
      [username, passwordHash]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(400).json({ success: false, error: "Username may already be taken." });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query(
    "SELECT password_hash FROM users WHERE username = $1",
    [username]
  );

  if (result.rows.length === 0) {
    return res.status(400).json({ success: false, error: "Unknown user." });
  }

  const match = await bcrypt.compare(password, result.rows[0].password_hash);
  if (!match) {
    return res.status(401).json({ success: false, error: "Incorrect password." });
  }

  res.json({ success: true });
});

app.listen(4000, () => console.log("Baseline auth server listening on http://localhost:4000"));