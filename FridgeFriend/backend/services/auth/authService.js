import bcrypt from "bcrypt";
import pool from "../../db.js";

const BCRYPT_ROUNDS = 12;

export async function signup({ username, password }) {
  const cleanUsername = String(username ?? "").trim();
  const cleanPassword = String(password ?? "");

  if (!cleanUsername) {
    return { status: 400, body: { message: "Missing username" } };
  }

  if (cleanUsername.length > 30) {
    return { status: 400, body: { message: "Username too long (max 30)" } };
  }

  if (!cleanPassword || cleanPassword.length < 6) {
    return {
      status: 400,
      body: { message: "Password must be at least 6 characters" },
    };
  }

  try {
    const hash = await bcrypt.hash(cleanPassword, BCRYPT_ROUNDS);

    const r = await pool.query(
      `
      INSERT INTO users (username, password_hash, notification_period_preference)
      VALUES ($1, $2, 0)
      RETURNING id, username
      `,
      [cleanUsername, hash],
    );

    return {
      status: 201,
      body: {
        user_id: r.rows[0].id,
        username: r.rows[0].username,
      },
    };
  } catch (e) {
    if (e?.code === "23505") {
      return { status: 409, body: { message: "Username already exists" } };
    }

    console.error("Signup error:", e);
    return {
      status: 500,
      body: { message: "Server error creating account" },
    };
  }
}

export async function login({ username, password }) {
  const cleanUsername = String(username ?? "").trim();
  const cleanPassword = String(password ?? "");

  if (!cleanUsername || !cleanPassword) {
    return {
      status: 400,
      body: { message: "Missing username or password" },
    };
  }

  try {
    const r = await pool.query(
      `
      SELECT id, username, password_hash
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [cleanUsername],
    );

    if (!r.rows.length) {
      return { status: 401, body: { message: "Invalid credentials" } };
    }

    const row = r.rows[0];

    if (!row.password_hash) {
      return { status: 401, body: { message: "Invalid credentials" } };
    }

    const ok = await bcrypt.compare(cleanPassword, row.password_hash);
    if (!ok) {
      return { status: 401, body: { message: "Invalid credentials" } };
    }

    return {
      status: 200,
      body: { user_id: row.id, username: row.username },
    };
  } catch (err) {
    console.error("Login error:", err);
    return { status: 500, body: { message: "Server error" } };
  }
}

export default {
  signup,
  login,
};