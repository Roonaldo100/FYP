import pool from "../../db.js";

function parseOptionalUserId(raw) {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) raw = raw[0];

  const s = String(raw).trim();
  if (!s) return null;

  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;

  return n;
}

export async function getStores(userId) {
  const uid = parseOptionalUserId(userId);

  try {
    if (uid) {
      const result = await pool.query(
        `
        SELECT id, name, is_system, owner_user_id
        FROM stores
        WHERE is_system = true OR owner_user_id = $1
        ORDER BY is_system DESC, name ASC
        `,
        [uid],
      );
      return result.rows;
    }

    const result = await pool.query(
      `
      SELECT id, name, is_system, owner_user_id
      FROM stores
      WHERE is_system = true
      ORDER BY name ASC
      `,
    );
    return result.rows;
  } catch (err) {
    console.error("Store fetch error:", err);
    const e = new Error("Server error loading stores");
    e.statusCode = 500;
    throw e;
  }
}

export async function createStore({ name, userId }) {
  const uid = parseOptionalUserId(userId);

  if (!uid) {
    const e = new Error("Missing userId");
    e.statusCode = 400;
    throw e;
  }

  if (!name || !String(name).trim()) {
    const e = new Error("Missing store name");
    e.statusCode = 400;
    throw e;
  }

  const cleaned = String(name).trim();

  try {
    const existing = await pool.query(
      `
      SELECT id, name, is_system, owner_user_id
      FROM stores
      WHERE LOWER(name) = LOWER($1)
        AND (is_system = true OR owner_user_id = $2)
      LIMIT 1
      `,
      [cleaned, uid],
    );

    if (existing.rows.length > 0) {
      return {
        store_id: existing.rows[0].id,
        store_name: existing.rows[0].name,
        reused: true,
      };
    }

    const inserted = await pool.query(
      `INSERT INTO stores (name, is_system, owner_user_id) VALUES ($1, false, $2) RETURNING id, name`,
      [cleaned, uid],
    );

    return {
      store_id: inserted.rows[0].id,
      store_name: inserted.rows[0].name,
      reused: false,
    };
  } catch (err) {
    console.error("Create store error:", err);
    const e = new Error("Server error creating store");
    e.statusCode = 500;
    throw e;
  }
}

export default {
  getStores,
  createStore,
};