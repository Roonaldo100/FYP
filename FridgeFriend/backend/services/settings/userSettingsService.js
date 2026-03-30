import pool from "../../db.js";

export const MAX_NOTIFICATION_DAYS = 3650;

export async function getUserSettings(userId) {
  const uid = Number(userId);

  if (!Number.isInteger(uid) || uid <= 0) {
    const err = new Error("Invalid userId");
    err.statusCode = 400;
    throw err;
  }

  try {
    const r = await pool.query(
      `
      SELECT notification_period_preference
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [uid],
    );

    if (r.rows.length === 0) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    return {
      notification_period_preference: Number(
        r.rows[0].notification_period_preference ?? 0,
      ),
      max_notification_days: MAX_NOTIFICATION_DAYS,
    };
  } catch (err) {
    if (err.statusCode) throw err;
    console.error("Get settings error:", err);
    const e = new Error("Server error loading settings");
    e.statusCode = 500;
    throw e;
  }
}

export async function updateNotificationPeriod(
  userId,
  notification_period_preference,
  overrideExisting,
) {
  const uid = Number(userId);
  const pref = Number(notification_period_preference);

  if (!Number.isInteger(uid) || uid <= 0) {
    const err = new Error("Invalid userId");
    err.statusCode = 400;
    throw err;
  }

  if (!Number.isFinite(pref) || !Number.isInteger(pref) || pref < 0) {
    const err = new Error("Invalid notification_period_preference");
    err.statusCode = 400;
    throw err;
  }

  if (pref > MAX_NOTIFICATION_DAYS) {
    const err = new Error(
      `notification_period_preference must be <= ${MAX_NOTIFICATION_DAYS}`
    );
    err.statusCode = 400;
    throw err;
  }

  const override = Boolean(overrideExisting);

  try {
    await pool.query(
      `
      UPDATE users
      SET notification_period_preference = $1
      WHERE id = $2
      `,
      [pref, uid],
    );

    const r = await pool.query(
      `
      SELECT
        up.id AS user_product_id,
        p.name AS product_name,
        (up.expiry_date::date - CURRENT_DATE) AS days_left,
        CASE
          WHEN $2::boolean = true THEN u.notification_period_preference
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
            WHEN $2::boolean = true THEN u.notification_period_preference
            WHEN COALESCE(up.expiry_period_days, 0) > 0 THEN up.expiry_period_days
            ELSE u.notification_period_preference
          END
      ORDER BY up.id ASC
      LIMIT 200;
      `,
      [uid, override],
    );

    return {
      notification_period_preference: pref,
      overrideExisting: override,
      pending: r.rows.map((row) => ({
        user_product_id: Number(row.user_product_id),
        product_name: String(row.product_name),
        days_left: Number(row.days_left),
        effective_period_days: Number(row.effective_period_days),
      })),
    };
  } catch (err) {
    if (err.statusCode) throw err;
    console.error("Update settings error:", err);
    const e = new Error("Server error updating settings");
    e.statusCode = 500;
    throw e;
  }
}

export default {
  getUserSettings,
  updateNotificationPeriod,
};