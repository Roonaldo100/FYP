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

async function getTescoStoreId() {
  try {
    const r = await pool.query(
      `SELECT id FROM stores WHERE LOWER(name) = 'tesco' AND is_system = true LIMIT 1`,
    );
    if (r.rows.length > 0) return r.rows[0].id;
  } catch (e) {
    console.warn("getTescoStoreId error:", e?.message ?? e);
  }
  return 1;
}

async function getNoStoreId() {
  const noStoreName = "No store";
  try {
    const r = await pool.query(
      `SELECT id FROM stores WHERE LOWER(name) = LOWER($1) AND is_system = true LIMIT 1`,
      [noStoreName],
    );
    if (r.rows.length > 0) return r.rows[0].id;

    const inserted = await pool.query(
      `INSERT INTO stores (name, is_system, owner_user_id) VALUES ($1, true, NULL) RETURNING id`,
      [noStoreName],
    );
    return inserted.rows[0].id;
  } catch (e) {
    console.warn("getNoStoreId error:", e?.message ?? e);
    return await getTescoStoreId();
  }
}

async function bumpProductUsage(clientOrPool, userId, productId, source) {
  const shoppingDelta = source === "shopping" ? 1 : 0;
  const inventoryDelta = source === "inventory" ? 1 : 0;

  await clientOrPool.query(
    `
    INSERT INTO user_product_usage (
      user_id,
      product_id,
      shopping_adds,
      inventory_adds,
      last_shopping_at,
      last_inventory_at,
      last_used_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      CASE WHEN $3 = 1 THEN now() ELSE NULL END,
      CASE WHEN $4 = 1 THEN now() ELSE NULL END,
      now()
    )
    ON CONFLICT (user_id, product_id)
    DO UPDATE SET
      shopping_adds = user_product_usage.shopping_adds + EXCLUDED.shopping_adds,
      inventory_adds = user_product_usage.inventory_adds + EXCLUDED.inventory_adds,
      last_shopping_at = CASE
        WHEN EXCLUDED.shopping_adds = 1 THEN now()
        ELSE user_product_usage.last_shopping_at
      END,
      last_inventory_at = CASE
        WHEN EXCLUDED.inventory_adds = 1 THEN now()
        ELSE user_product_usage.last_inventory_at
      END,
      last_used_at = now()
    `,
    [userId, productId, shoppingDelta, inventoryDelta],
  );
}

export async function addProductToInventory({
  userId,
  productId,
  storeId,
  expiryDate,
  price,
  expiryPeriodDays,
  quantity,
}) {
  const uid = parseOptionalUserId(userId);
  const pid = Number(productId);

  const qtyRaw =
    quantity === undefined || quantity === null || String(quantity).trim() === ""
      ? 1
      : Number(quantity);

  if (
    !uid ||
    !Number.isInteger(pid) ||
    pid <= 0 ||
    !Number.isInteger(qtyRaw) ||
    qtyRaw <= 0
  ) {
    const err = new Error("Missing or invalid required fields");
    err.statusCode = 400;
    throw err;
  }

  let effectiveStoreId = null;

  if (storeId === undefined || storeId === null || String(storeId).trim() === "") {
    effectiveStoreId = await getNoStoreId();
  } else {
    const sid = Number(storeId);
    if (!Number.isFinite(sid) || !Number.isInteger(sid) || sid <= 0) {
      const err = new Error("Invalid storeId");
      err.statusCode = 400;
      throw err;
    }

    const storeOk = await pool.query(
      `
      SELECT id
      FROM stores
      WHERE id = $1 AND (is_system = true OR owner_user_id = $2)
      LIMIT 1
      `,
      [sid, uid],
    );

    if (!storeOk.rows.length) {
      const err = new Error("Invalid store for this user");
      err.statusCode = 400;
      throw err;
    }

    effectiveStoreId = sid;
  }

  let expiryPeriodToStore = 0;
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
    expiryPeriodToStore = n;
  }

  const exp =
    expiryDate === undefined || expiryDate === null || String(expiryDate).trim() === ""
      ? null
      : String(expiryDate).trim();

  if (exp !== null && !/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
    const err = new Error("Invalid expiryDate (YYYY-MM-DD or null)");
    err.statusCode = 400;
    throw err;
  }

  let priceToStore = null;
  if (price !== undefined && price !== null && String(price).trim() !== "") {
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0) {
      const err = new Error("Invalid price");
      err.statusCode = 400;
      throw err;
    }
    priceToStore = p;
  }

  await pool.query(
    `
    INSERT INTO product_store (product_id, store_id)
    VALUES ($1, $2)
    ON CONFLICT (product_id, store_id) DO NOTHING
    `,
    [pid, effectiveStoreId],
  );

  const client = await pool.connect();
  let upRow = null;

  try {
    await client.query("BEGIN");

    for (let i = 0; i < qtyRaw; i++) {
      const inserted = await client.query(
        `
        INSERT INTO user_products (user_id, product_id, store_id, expiry_date, expiry_period_days, notified)
        VALUES ($1, $2, $3, $4, $5, false)
        RETURNING id, expiry_period_days, expiry_date
        `,
        [uid, pid, effectiveStoreId, exp, expiryPeriodToStore],
      );

      upRow = inserted.rows[0];
    }

    await client.query("COMMIT");
  } catch (txErr) {
    await client.query("ROLLBACK");
    throw txErr;
  } finally {
    client.release();
  }

  for (let i = 0; i < qtyRaw; i++) {
    await bumpProductUsage(pool, uid, pid, "inventory");
  }

  const userPrefRes = await pool.query(
    `SELECT notification_period_preference FROM users WHERE id = $1 LIMIT 1`,
    [uid],
  );

  const userPref = userPrefRes.rows.length
    ? Number(userPrefRes.rows[0].notification_period_preference ?? 0)
    : 0;

  let days_left = null;
  if (upRow?.expiry_date) {
    const daysLeftRes = await pool.query(
      `SELECT ($1::date - CURRENT_DATE) AS days_left`,
      [upRow.expiry_date],
    );
    days_left = Number(daysLeftRes.rows[0].days_left);
  }

  const expiry_period_days = Number(upRow?.expiry_period_days ?? 0);
  const effective_period_days =
    expiry_period_days > 0 ? expiry_period_days : userPref;

  if (priceToStore !== null) {
    await pool.query(
      `
      INSERT INTO user_product_prices (user_id, product_id, store_id, last_price, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, product_id, store_id)
      DO UPDATE SET
        last_price = EXCLUDED.last_price,
        updated_at = CURRENT_TIMESTAMP
      `,
      [uid, pid, effectiveStoreId, priceToStore],
    );
  }

  return {
    message: qtyRaw === 1 ? "Product added successfully" : "Products added successfully",
    added_count: qtyRaw,
    user_product_id: upRow ? Number(upRow.id) : null,
    expiry_period_days,
    effective_period_days,
    days_left,
  };
}

export async function getUserOwnedProduct(userId, productId) {
  const uid = Number(userId);
  const pid = Number(productId);

  if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(pid) || pid <= 0) {
    const err = new Error("Invalid userId or productId");
    err.statusCode = 400;
    throw err;
  }

  const r = await pool.query(
    `
    SELECT id, name, food_type, is_system, owner_user_id
    FROM products
    WHERE id = $1
      AND is_system = false
      AND owner_user_id = $2
    LIMIT 1
    `,
    [pid, uid]
  );

  if (!r.rows.length) {
    const err = new Error("Product not found");
    err.statusCode = 404;
    throw err;
  }

  return r.rows[0];
}

export async function updateUserOwnedProduct(userId, productId, payload) {
  const uid = Number(userId);
  const pid = Number(productId);

  if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(pid) || pid <= 0) {
    const err = new Error("Invalid userId or productId");
    err.statusCode = 400;
    throw err;
  }

  const name = String(payload?.name || "").trim().slice(0, 30) || null;

  const foodTypeRaw = payload?.food_type;
  const foodType =
    foodTypeRaw === undefined || foodTypeRaw === null || String(foodTypeRaw).trim() === ""
      ? null
      : Number(foodTypeRaw);

  if (!name) {
    const err = new Error("Missing name");
    err.statusCode = 400;
    throw err;
  }
  if (foodType !== null && (!Number.isInteger(foodType) || foodType <= 0)) {
    const err = new Error("Invalid food_type");
    err.statusCode = 400;
    throw err;
  }

  if (foodType !== null) {
    const ftOk = await pool.query(
      `
      SELECT id
      FROM food_types
      WHERE id = $1
        AND (is_system = true OR owner_user_id = $2)
      LIMIT 1
      `,
      [foodType, uid]
    );

    if (!ftOk.rows.length) {
      const err = new Error("Invalid food_type for this user");
      err.statusCode = 400;
      throw err;
    }
  }

  const upd = await pool.query(
    `
    UPDATE products
    SET name = $1,
        food_type = $2
    WHERE id = $3
      AND is_system = false
      AND owner_user_id = $4
    RETURNING id, name, food_type, is_system, owner_user_id
    `,
    [name, foodType, pid, uid]
  );

  if (!upd.rows.length) {
    const err = new Error("Product not found");
    err.statusCode = 404;
    throw err;
  }

  return { message: "Updated", product: upd.rows[0] };
}

export async function removeUserProducts({ userId, productId, storeId, quantity }) {
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
      ORDER BY expiry_date ASC NULLS LAST, id ASC
      LIMIT $4
    )
    RETURNING id
    `,
    [userId, productId, storeId ?? null, qty],
  );

  return { removed: del.rowCount };
}

export async function updateStoreAndPrice({
  userId,
  productId,
  fromStoreId,
  toStoreId,
  lastPrice,
}) {
  const uid = Number(userId);
  const pid = Number(productId);

  const fromSid =
    fromStoreId === undefined ||
    fromStoreId === null ||
    String(fromStoreId) === ""
      ? null
      : Number(fromStoreId);

  const toSid =
    toStoreId === undefined || toStoreId === null || String(toStoreId) === ""
      ? null
      : Number(toStoreId);

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

  if (fromSid !== null && (!Number.isFinite(fromSid) || fromSid <= 0)) {
    const err = new Error("Invalid fromStoreId");
    err.statusCode = 400;
    throw err;
  }
  if (toSid !== null && (!Number.isFinite(toSid) || toSid <= 0)) {
    const err = new Error("Invalid toStoreId");
    err.statusCode = 400;
    throw err;
  }

  let priceToSet = null;
  let hasPrice = false;

  if (
    lastPrice !== undefined &&
    lastPrice !== null &&
    String(lastPrice).trim() !== ""
  ) {
    const n = Number(lastPrice);
    if (!Number.isFinite(n) || n < 0) {
      const err = new Error("Invalid lastPrice");
      err.statusCode = 400;
      throw err;
    }
    priceToSet = n;
    hasPrice = true;
  }

  if (toSid !== null) {
    const storeOk = await pool.query(
      `
      SELECT id
      FROM stores
      WHERE id = $1 AND (is_system = true OR owner_user_id = $2)
      LIMIT 1
      `,
      [toSid, uid],
    );
    if (!storeOk.rows.length) {
      const err = new Error("Invalid store for this user");
      err.statusCode = 400;
      throw err;
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (toSid !== null) {
      await client.query(
        `
        INSERT INTO product_store (product_id, store_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [pid, toSid],
      );
    }

    const moved = await client.query(
      `
      UPDATE user_products
      SET store_id = $1
      WHERE user_id = $2
        AND product_id = $3
        AND store_id IS NOT DISTINCT FROM $4
      `,
      [toSid, uid, pid, fromSid],
    );

    if (hasPrice) {
      const upd = await client.query(
        `
        UPDATE user_product_prices
        SET last_price = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND product_id = $2
          AND store_id IS NOT DISTINCT FROM $3
        `,
        [uid, pid, toSid, priceToSet],
      );

      if (upd.rowCount === 0) {
        await client.query(
          `
          INSERT INTO user_product_prices (user_id, product_id, store_id, last_price, updated_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          `,
          [uid, pid, toSid, priceToSet],
        );
      }
    }

    let storeName = null;
    if (toSid !== null) {
      const sn = await client.query(
        `SELECT name FROM stores WHERE id = $1 LIMIT 1`,
        [toSid],
      );
      storeName = sn.rows[0]?.name ?? null;
    }

    await client.query("COMMIT");

    return {
      updated: true,
      moved_rows: moved.rowCount,
      store_id: toSid,
      store_name: storeName,
      price_updated: hasPrice,
    };
  } catch (e) {
    await client.query("ROLLBACK");

    const msg = String(e?.message || "");
    if (
      msg.includes("fk_user_product_store") ||
      msg.includes("violates foreign key constraint")
    ) {
      const err = new Error(
        "Cannot move to that store for this product (missing product-store link).",
      );
      err.statusCode = 400;
      throw err;
    }

    throw e;
  } finally {
    client.release();
  }
}

export default {
  addProductToInventory,
  getUserOwnedProduct,
  updateUserOwnedProduct,
  removeUserProducts,
  updateStoreAndPrice,
};