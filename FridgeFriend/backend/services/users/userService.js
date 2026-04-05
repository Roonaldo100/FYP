import pool from "../../db.js";

export async function getUserFoodTypeProducts(userId, foodTypeId) {
  const uid = Number(userId);
  const ftid = Number(foodTypeId);

  try {
    const q = `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        s.id AS store_id,
        s.name AS store_name,
        COUNT(up.id)::int AS quantity,
        CASE
          WHEN MIN(up.expiry_date) IS NULL THEN NULL
          ELSE TO_CHAR(MIN(up.expiry_date), 'YYYY-MM-DD')
        END AS nearest_expiry,
        upp.last_price AS last_price
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      LEFT JOIN stores s ON s.id = up.store_id
      LEFT JOIN user_product_prices upp
        ON upp.user_id = up.user_id
       AND upp.product_id = up.product_id
       AND upp.store_id IS NOT DISTINCT FROM up.store_id
      WHERE up.user_id = $1
        AND p.food_type = $2
      GROUP BY
        p.id,
        p.name,
        s.id,
        s.name,
        upp.last_price
      ORDER BY p.name;
    `;

    const result = await pool.query(q, [uid, ftid]);

    return result.rows.map((row) => ({
      product_id: Number(row.product_id),
      product_name: String(row.product_name),
      store_id: row.store_id === null ? null : Number(row.store_id),
      store_name: row.store_name ?? null,
      quantity: Number(row.quantity),
      nearest_expiry: row.nearest_expiry,
      last_price:
        row.last_price === null || row.last_price === undefined
          ? null
          : Number(row.last_price),
    }));
  } catch (err) {
    console.error("User product fetch error:", err);
    const e = new Error("Server error");
    e.statusCode = 500;
    throw e;
  }
}

export default {
  getUserFoodTypeProducts,
};