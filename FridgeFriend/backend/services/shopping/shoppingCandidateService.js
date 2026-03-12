import pool from "../../db.js";

export async function getInventoryCandidates(userId) {
  const uid = Number(userId);

  if (!Number.isInteger(uid) || uid <= 0) {
    const err = new Error("Invalid userId");
    err.statusCode = 400;
    throw err;
  }

  try {
    const r = await pool.query(
      `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        up.store_id,
        s.name AS store_name,
        COUNT(*)::int AS qty_in_inventory
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      LEFT JOIN stores s ON s.id = up.store_id
      WHERE up.user_id = $1
        AND (p.is_system = true OR p.owner_user_id = $1)
        AND (
          up.store_id IS NULL
          OR s.is_system = true
          OR s.owner_user_id = $1
        )
      GROUP BY p.id, p.name, up.store_id, s.name
      ORDER BY qty_in_inventory DESC, p.name ASC, s.name ASC NULLS LAST
      LIMIT 300
      `,
      [uid],
    );

    return r.rows.map((row) => ({
      product_id: Number(row.product_id),
      product_name: String(row.product_name),
      suggested_store_id: row.store_id != null ? Number(row.store_id) : null,
      suggested_store_name: row.store_name ?? null,
      qty_in_inventory: Number(row.qty_in_inventory),
    }));
  } catch (e) {
    console.error("shopping candidates inventory error:", e);
    const err = new Error("Server error loading inventory candidates");
    err.statusCode = 500;
    throw err;
  }
}

export async function getHistoryCandidates(userId) {
  const uid = Number(userId);

  if (!Number.isInteger(uid) || uid <= 0) {
    const err = new Error("Invalid userId");
    err.statusCode = 400;
    throw err;
  }

  try {
    const r = await pool.query(
      `
      SELECT DISTINCT ON (upp.product_id)
        upp.product_id,
        p.name AS product_name,
        upp.store_id,
        s.name AS store_name,
        upp.last_price,
        upp.updated_at
      FROM user_product_prices upp
      JOIN products p ON p.id = upp.product_id
      LEFT JOIN stores s ON s.id = upp.store_id
      WHERE upp.user_id = $1
        AND (p.is_system = true OR p.owner_user_id = $1)
        AND (
          upp.store_id IS NULL
          OR s.is_system = true
          OR s.owner_user_id = $1
        )
      ORDER BY upp.product_id, upp.updated_at DESC NULLS LAST, upp.id DESC
      LIMIT 400
      `,
      [uid],
    );

    return r.rows.map((row) => ({
      product_id: Number(row.product_id),
      product_name: String(row.product_name),
      suggested_store_id: row.store_id ?? null,
      suggested_store_name: row.store_name ?? null,
      suggested_price: row.last_price ?? null,
    }));
  } catch (e) {
    console.error("shopping candidates history error:", e);
    const err = new Error("Server error loading history candidates");
    err.statusCode = 500;
    throw err;
  }
}

export default {
  getInventoryCandidates,
  getHistoryCandidates,
};