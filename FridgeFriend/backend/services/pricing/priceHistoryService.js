import pool from "../../db.js";

function parseOptionalStoreId(raw) {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) raw = raw[0];

  const s = String(raw).trim();
  if (!s) return null;

  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    const err = new Error("Invalid storeId");
    err.statusCode = 400;
    throw err;
  }
  return n;
}

export async function getLastPrice(userId, productId, storeIdRaw) {
  const uid = Number(userId);
  const pid = Number(productId);

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

  const storeId = parseOptionalStoreId(storeIdRaw);

  const r = await pool.query(
    `
    SELECT last_price
    FROM user_product_prices
    WHERE user_id = $1
      AND product_id = $2
      AND store_id IS NOT DISTINCT FROM $3
    LIMIT 1
    `,
    [uid, pid, storeId],
  );

  return { last_price: r.rows.length ? r.rows[0].last_price : null };
}

export async function getLastPriceAny(userId, productId) {
  const uid = Number(userId);
  const pid = Number(productId);

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

  const r = await pool.query(
    `
    SELECT
      upp.store_id,
      upp.last_price,
      s.name AS store_name
    FROM user_product_prices upp
    LEFT JOIN stores s ON s.id = upp.store_id
    WHERE upp.user_id = $1
      AND upp.product_id = $2
      AND (
        upp.store_id IS NULL
        OR s.is_system = true
        OR s.owner_user_id = $1
      )
    ORDER BY upp.updated_at DESC NULLS LAST, upp.id DESC
    LIMIT 1
    `,
    [uid, pid],
  );

  if (!r.rows.length) {
    return { store_id: null, store_name: null, last_price: null };
  }

  return {
    store_id: r.rows[0].store_id ?? null,
    store_name: r.rows[0].store_name ?? null,
    last_price: r.rows[0].last_price ?? null,
  };
}

export async function clearPersonalHistory(
  userId,
  productId,
  confirmDeleteInventory = false,
) {
  const uid = Number(userId);
  const pid = Number(productId);

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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inv = await client.query(
      `
      SELECT COUNT(*)::int AS n
      FROM user_products
      WHERE user_id = $1 AND product_id = $2
      `,
      [uid, pid],
    );
    const inventoryCount = Number(inv.rows[0]?.n ?? 0);

    const hist = await client.query(
      `
      SELECT COUNT(*)::int AS n
      FROM user_product_prices
      WHERE user_id = $1 AND product_id = $2
      `,
      [uid, pid],
    );
    const historyCount = Number(hist.rows[0]?.n ?? 0);

    if (inventoryCount > 0 && !confirmDeleteInventory) {
      await client.query("ROLLBACK");
      const err = new Error(
        "This product exists in your inventory. Clearing history will also delete your current inventory for this product. Confirm to proceed.",
      );
      err.statusCode = 409;
      err.payload = {
        inventoryCount,
        historyCount,
        requiresConfirmation: true,
      };
      throw err;
    }

    const delHist = await client.query(
      `
      DELETE FROM user_product_prices
      WHERE user_id = $1 AND product_id = $2
      `,
      [uid, pid],
    );

    const delInv = await client.query(
      `
      DELETE FROM user_products
      WHERE user_id = $1 AND product_id = $2
      `,
      [uid, pid],
    );

    await client.query("COMMIT");

    return {
      cleared: true,
      deleted_history_rows: delHist.rowCount,
      deleted_inventory_rows: delInv.rowCount,
    };
  } catch (e) {
    if (!String(e?.message || "").includes("Confirm to proceed")) {
      await client.query("ROLLBACK");
    }
    throw e;
  } finally {
    client.release();
  }
}

export default {
  getLastPrice,
  getLastPriceAny,
  clearPersonalHistory,
};