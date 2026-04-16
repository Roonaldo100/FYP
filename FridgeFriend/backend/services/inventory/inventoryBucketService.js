import pool from "../../db.js";

function normalizeExpiryDateInput(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;

  const s = String(v).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  return s;
}

export async function getBuckets({ userId, productId, storeId }) {
  const uid = Number(userId);
  const pid = Number(productId);

  const sid =
    storeId === undefined || storeId === null || String(storeId) === ""
      ? null
      : Number(storeId);

  if (!uid || !pid) {
    const err = new Error("Missing required fields");
    err.statusCode = 400;
    throw err;
  }

  const r = await pool.query(
    `
    SELECT
      CASE
        WHEN expiry_date IS NULL THEN NULL
        ELSE TO_CHAR(expiry_date, 'YYYY-MM-DD')
      END AS expiry_date,
      COUNT(*)::int AS quantity
    FROM user_products
    WHERE user_id = $1
      AND product_id = $2
      AND store_id IS NOT DISTINCT FROM $3
    GROUP BY expiry_date
    ORDER BY expiry_date ASC NULLS LAST;
    `,
    [uid, pid, sid]
  );

  return r.rows.map((row) => ({
    expiry_date: row.expiry_date,
    quantity: Number(row.quantity),
  }));
}

export async function removeByExpiry({
  userId,
  productId,
  storeId,
  expiryDate,
  quantity,
}) {
  const qty = Number(quantity);

  if (!userId || !productId || !qty || qty <= 0) {
    const err = new Error("Missing required fields");
    err.statusCode = 400;
    throw err;
  }

  const del = await pool.query(
    `
    DELETE FROM user_products
    WHERE id IN (
      SELECT id
      FROM user_products
      WHERE user_id = $1
        AND product_id = $2
        AND store_id IS NOT DISTINCT FROM $3
        AND expiry_date IS NOT DISTINCT FROM $4
      ORDER BY id ASC
      LIMIT $5
    )
    RETURNING id
    `,
    [userId, productId, storeId ?? null, expiryDate ?? null, qty]
  );

  return { removed: del.rowCount };
}

export async function changeBucketExpiry({
  userId,
  productId,
  storeId,
  fromExpiryDate,
  toExpiryDate,
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

  const fromExp = normalizeExpiryDateInput(fromExpiryDate);
  const toExp = normalizeExpiryDateInput(toExpiryDate);

  if (fromExp === undefined || toExp === undefined) {
    const err = new Error("Missing fromExpiryDate or toExpiryDate");
    err.statusCode = 400;
    throw err;
  }

  if (fromExp !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fromExp)) {
    const err = new Error("Invalid fromExpiryDate (YYYY-MM-DD or null)");
    err.statusCode = 400;
    throw err;
  }

  if (toExp !== null && !/^\d{4}-\d{2}-\d{2}$/.test(toExp)) {
    const err = new Error("Invalid toExpiryDate (YYYY-MM-DD or null)");
    err.statusCode = 400;
    throw err;
  }

  const r = await pool.query(
    `
    UPDATE user_products
    SET expiry_date = $1
    WHERE user_id = $2
      AND product_id = $3
      AND store_id IS NOT DISTINCT FROM $4
      AND expiry_date IS NOT DISTINCT FROM $5
    `,
    [toExp, uid, pid, sid, fromExp]
  );

  return { updated: true, moved_rows: r.rowCount };
}

export async function moveByExpiryQuantity({
  userId,
  productId,
  storeId,
  fromExpiryDate,
  toExpiryDate,
  quantity,
}) {
  const uid = Number(userId);
  const pid = Number(productId);
  const qty = Number(quantity);

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

  if (!Number.isInteger(qty) || qty <= 0) {
    const err = new Error("Invalid quantity");
    err.statusCode = 400;
    throw err;
  }

  const fromExp = normalizeExpiryDateInput(fromExpiryDate);
  const toExp = normalizeExpiryDateInput(toExpiryDate);

  if (fromExp === undefined || toExp === undefined) {
    const err = new Error("Missing fromExpiryDate or toExpiryDate");
    err.statusCode = 400;
    throw err;
  }

  if (fromExp !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fromExp)) {
    const err = new Error("Invalid fromExpiryDate (YYYY-MM-DD or null)");
    err.statusCode = 400;
    throw err;
  }

  if (toExp !== null && !/^\d{4}-\d{2}-\d{2}$/.test(toExp)) {
    const err = new Error("Invalid toExpiryDate (YYYY-MM-DD or null)");
    err.statusCode = 400;
    throw err;
  }

  if ((fromExp ?? null) === (toExp ?? null)) {
    return { updated: true, moved_rows: 0 };
  }

  const r = await pool.query(
    `
    UPDATE user_products
    SET expiry_date = $1
    WHERE id IN (
      SELECT id
      FROM user_products
      WHERE user_id = $2
        AND product_id = $3
        AND store_id IS NOT DISTINCT FROM $4
        AND expiry_date IS NOT DISTINCT FROM $5
      ORDER BY id ASC
      LIMIT $6
    )
    RETURNING id
    `,
    [toExp, uid, pid, sid, fromExp, qty]
  );

  return { updated: true, moved_rows: r.rowCount };
}

export default {
  getBuckets,
  removeByExpiry,
  changeBucketExpiry,
  moveByExpiryQuantity,
};