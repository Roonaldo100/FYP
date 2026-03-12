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
        COUNT(up.id) AS quantity,
        MIN(up.expiry_date) AS nearest_expiry,
        upp.last_price AS last_price
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      LEFT JOIN stores s ON s.id = up.store_id
      LEFT JOIN user_product_prices upp
        ON upp.user_id = up.user_id
      AND upp.product_id = up.product_id
      AND upp.store_id IS NOT DISTINCT FROM up.store_id
      WHERE up.user_id = $1 AND p.food_type = $2
      GROUP BY
        p.id,
        p.name,
        s.id,
        s.name,
        upp.last_price
      ORDER BY p.name;
    `;

    const result = await pool.query(q, [uid, ftid]);
    return result.rows;
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