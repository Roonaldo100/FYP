import pool from "../../db.js";

export async function getPendingNotifications(userId) {
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
        up.id AS user_product_id,
        p.name AS product_name,
        (up.expiry_date::date - CURRENT_DATE) AS days_left,
        CASE
          WHEN COALESCE(up.expiry_period_days, 0) > 0 THEN up.expiry_period_days
          ELSE u.notification_period_preference
        END AS effective_period_days
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      JOIN users u ON u.id = up.user_id
      WHERE up.user_id = $1
        AND up.notified = false
        AND up.expiry_date IS NOT NULL
        AND (up.expiry_date::date - CURRENT_DATE) <=
          CASE
            WHEN COALESCE(up.expiry_period_days, 0) > 0 THEN up.expiry_period_days
            ELSE u.notification_period_preference
          END
      ORDER BY up.id ASC
      LIMIT 50;
      `,
      [uid],
    );

    return r.rows.map((row) => ({
      ...row,
      days_left: Number(row.days_left),
      effective_period_days: Number(row.effective_period_days),
    }));
  } catch (err) {
    if (err.statusCode) throw err;
    console.error("Pending notifications error:", err);
    const e = new Error("Server error loading pending notifications");
    e.statusCode = 500;
    throw e;
  }
}

export default {
  getPendingNotifications,
};