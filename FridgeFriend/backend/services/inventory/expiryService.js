import pool from "../../db.js";

export async function setExpiryPeriod({
  userId,
  productId,
  storeId,
  expiryDate,
  expiryPeriodDays,
}) {
  const uid = Number(userId);
  const pid = Number(productId);
  const sid =
    storeId === undefined || storeId === null || String(storeId) === ""
      ? null
      : Number(storeId);

  if (
    !Number.isInteger(uid) ||
    uid <= 0 ||
    !Number.isInteger(pid) ||
    pid <= 0
  ) {
    const err = new Error("Invalid userId or productId");
    err.statusCode = 400;
    throw err;
  }

  if (sid !== null && (!Number.isFinite(sid) || sid <= 0)) {
    const err = new Error("Invalid storeId");
    err.statusCode = 400;
    throw err;
  }

  let period = 0;
  if (
    expiryPeriodDays !== undefined &&
    expiryPeriodDays !== null &&
    String(expiryPeriodDays).trim() !== ""
  ) {
    const n = Number(expiryPeriodDays);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      const err = new Error("Invalid expiryPeriodDays");
      err.statusCode = 400;
      throw err;
    }
    period = n;
  }

  const exp =
    expiryDate === undefined
      ? undefined
      : expiryDate === null || String(expiryDate).trim() === ""
        ? null
        : String(expiryDate).trim();

  if (exp !== undefined && exp !== null) {
    const okFormat = /^\d{4}-\d{2}-\d{2}$/.test(exp);
    if (!okFormat) {
      const err = new Error("Invalid expiryDate (YYYY-MM-DD or null)");
      err.statusCode = 400;
      throw err;
    }
  }

  const q = `
    UPDATE user_products
    SET expiry_period_days = $1
    WHERE user_id = $2
      AND product_id = $3
      AND store_id IS NOT DISTINCT FROM $4
      AND ($5::date IS NULL OR expiry_date IS NOT DISTINCT FROM $5::date)
    RETURNING id
  `;

  const r = await pool.query(q, [
    period,
    uid,
    pid,
    sid,
    exp === undefined ? null : exp,
  ]);

  return { updated: true, updated_rows: r.rowCount };
}

export async function markNotified(id) {
  const updated = await pool.query(
    `
    UPDATE user_products
    SET notified = true
    WHERE id = $1
    RETURNING id, notified
    `,
    [id],
  );

  if (updated.rows.length === 0) {
    const err = new Error("user_products row not found");
    err.statusCode = 404;
    throw err;
  }

  return { message: "Marked as notified", row: updated.rows[0] };
}

export async function getExpiringSoon(userId) {
  const uid = Number(userId);

  if (!Number.isInteger(uid) || uid <= 0) {
    const err = new Error("Invalid userId");
    err.statusCode = 400;
    throw err;
  }

  const r = await pool.query(
    `
    WITH rows AS (
      SELECT
        up.user_id,
        up.product_id,
        up.store_id,
        up.expiry_date,
        COALESCE(up.expiry_period_days, 0) AS expiry_period_days,
        COALESCE(u.notification_period_preference, 0) AS user_pref_days,
        CASE
          WHEN COALESCE(up.expiry_period_days, 0) > 0 THEN up.expiry_period_days
          ELSE COALESCE(u.notification_period_preference, 0)
        END AS effective_period_days,
        (up.expiry_date::date - CURRENT_DATE) AS days_left
      FROM user_products up
      JOIN users u ON u.id = up.user_id
      WHERE up.user_id = $1
        AND up.expiry_date IS NOT NULL
    ),
    filtered AS (
      SELECT *
      FROM rows
      WHERE days_left <= effective_period_days
    ),
    grouped AS (
      SELECT
        product_id,
        store_id,
        COUNT(*)::int AS quantity,
        MIN(expiry_date) AS nearest_expiry
      FROM filtered
      GROUP BY product_id, store_id
    )
    SELECT
      g.product_id,
      p.name AS product_name,
      g.store_id,
      s.name AS store_name,
      g.quantity,
      TO_CHAR(g.nearest_expiry, 'YYYY-MM-DD') AS nearest_expiry,
      (g.nearest_expiry::date - CURRENT_DATE) AS days_left,
      CASE
        WHEN COALESCE(f.expiry_period_days, 0) > 0 THEN f.expiry_period_days
        ELSE COALESCE(f.user_pref_days, 0)
      END AS effective_period_days
    FROM grouped g
    JOIN products p ON p.id = g.product_id
    LEFT JOIN stores s ON s.id = g.store_id
    JOIN LATERAL (
      SELECT expiry_period_days, user_pref_days
      FROM filtered f2
      WHERE f2.product_id = g.product_id
        AND f2.store_id IS NOT DISTINCT FROM g.store_id
      ORDER BY f2.expiry_date ASC
      LIMIT 1
    ) f ON true
    ORDER BY days_left ASC, product_name ASC;
    `,
    [uid],
  );

  return r.rows.map((row) => ({
    product_id: Number(row.product_id),
    product_name: String(row.product_name),
    store_id: row.store_id === null ? null : Number(row.store_id),
    store_name: row.store_name ?? null,
    quantity: Number(row.quantity),
    nearest_expiry: row.nearest_expiry,
    days_left: Number(row.days_left),
    effective_period_days: Number(row.effective_period_days),
  }));
}

export default {
  setExpiryPeriod,
  markNotified,
  getExpiringSoon,
};