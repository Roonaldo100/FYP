import pool from "../../db.js";

export async function getFrequentItems(userId, limitRaw) {
  const uid = Number(userId);
  const limit = Math.min(Math.max(Number(limitRaw ?? 40), 1), 100);

  if (!Number.isInteger(uid) || uid <= 0) {
    const err = new Error("Invalid userId");
    err.statusCode = 400;
    throw err;
  }

  try {
    const r = await pool.query(
      `
      SELECT
        upu.product_id,
        p.name AS product_name,
        upu.inventory_adds AS inv_count,
        upu.shopping_adds AS list_count,
        (COALESCE(upu.inventory_adds, 0) + COALESCE(upu.shopping_adds, 0))::int AS total_count,

        (
          SELECT up2.store_id
          FROM user_products up2
          LEFT JOIN stores s ON s.id = up2.store_id
          WHERE up2.user_id = $1
            AND up2.product_id = upu.product_id
            AND (
              up2.store_id IS NULL
              OR s.is_system = true
              OR s.owner_user_id = $1
            )
          GROUP BY up2.store_id
          ORDER BY COUNT(*) DESC NULLS LAST, up2.store_id NULLS LAST
          LIMIT 1
        ) AS suggested_store_id,

        (
          SELECT s2.name
          FROM user_products up3
          JOIN stores s2 ON s2.id = up3.store_id
          WHERE up3.user_id = $1
            AND up3.product_id = upu.product_id
            AND (
              s2.is_system = true
              OR s2.owner_user_id = $1
            )
          GROUP BY s2.name
          ORDER BY COUNT(*) DESC, s2.name ASC
          LIMIT 1
        ) AS suggested_store_name

      FROM user_product_usage upu
      JOIN products p ON p.id = upu.product_id
      WHERE upu.user_id = $1
        AND (p.is_system = true OR p.owner_user_id = $1)
      ORDER BY
        (COALESCE(upu.inventory_adds, 0) + COALESCE(upu.shopping_adds, 0)) DESC,
        p.name ASC
      LIMIT $2
      `,
      [uid, limit]
    );

    return r.rows.map((row) => ({
      product_id: Number(row.product_id),
      product_name: String(row.product_name),
      suggested_store_id:
        row.suggested_store_id != null ? Number(row.suggested_store_id) : null,
      suggested_store_name: row.suggested_store_name ?? null,
      total_count: Number(row.total_count ?? 0),
      inv_count: Number(row.inv_count ?? 0),
      list_count: Number(row.list_count ?? 0),
    }));
  } catch (err) {
    console.error("frequentItems error:", err);
    const e = new Error("Server error loading frequent items");
    e.statusCode = 500;
    throw e;
  }
}

export default {
  getFrequentItems,
};