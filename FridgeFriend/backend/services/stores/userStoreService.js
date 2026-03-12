import pool from "../../db.js";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.statusCode = status;
  }
}

async function assertStoreOwnedByUser(userId, storeId) {
  const r = await pool.query(
    `
    SELECT id, is_system, owner_user_id, name
    FROM stores
    WHERE id = $1
    LIMIT 1
    `,
    [storeId],
  );

  const row = r.rows[0] || null;
  if (!row) throw new HttpError(404, "Store not found");
  if (row.is_system) throw new HttpError(403, "System stores cannot be deleted");
  if (Number(row.owner_user_id) !== Number(userId)) {
    throw new HttpError(403, "Not your store");
  }

  return row;
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

export async function safeDeleteUserStore(userId, storeId, deletePriceHistory = false) {
  const uid = Number(userId);
  const sid = Number(storeId);
  const deleteHistory = deletePriceHistory === true;

  if (
    !Number.isInteger(uid) ||
    uid <= 0 ||
    !Number.isInteger(sid) ||
    sid <= 0
  ) {
    const e = new Error("Invalid userId or storeId");
    e.statusCode = 400;
    throw e;
  }

  const client = await pool.connect();
  try {
    await assertStoreOwnedByUser(uid, sid);

    const noStoreId = await getNoStoreId();

    if (Number(sid) === Number(noStoreId)) {
      const e = new Error("Cannot delete the No store record");
      e.statusCode = 400;
      throw e;
    }

    await client.query("BEGIN");

    const sli = await client.query(
      `
      UPDATE shopping_list_items
      SET store_id = $1
      WHERE store_id = $2
      RETURNING id
      `,
      [noStoreId, sid],
    );

    const productsToMoveRes = await client.query(
      `
      SELECT DISTINCT product_id
      FROM user_products
      WHERE store_id = $1
      `,
      [sid],
    );
    const productIdsToMove = productsToMoveRes.rows.map((r) =>
      Number(r.product_id),
    );

    let ensuredProductStoreLinks = 0;
    if (productIdsToMove.length > 0) {
      const ins = await client.query(
        `
        INSERT INTO product_store (product_id, store_id)
        SELECT UNNEST($1::int[]), $2
        ON CONFLICT (product_id, store_id) DO NOTHING
        `,
        [productIdsToMove, noStoreId],
      );
      ensuredProductStoreLinks = ins.rowCount ?? 0;
    }

    const up = await client.query(
      `
      UPDATE user_products
      SET store_id = $1
      WHERE store_id = $2
      RETURNING id
      `,
      [noStoreId, sid],
    );

    let uppMoved = 0;
    let uppDeleted = 0;

    if (deleteHistory) {
      const del = await client.query(
        `DELETE FROM user_product_prices WHERE store_id = $1 RETURNING id`,
        [sid],
      );
      uppDeleted = del.rowCount;
    } else {
      await client.query(
        `
        INSERT INTO user_product_prices (user_id, product_id, store_id, last_price, updated_at)
        SELECT user_id, product_id, $1, last_price, updated_at
        FROM user_product_prices
        WHERE store_id = $2
        ON CONFLICT (user_id, product_id, store_id) DO UPDATE SET
          last_price = CASE
            WHEN EXCLUDED.updated_at >= user_product_prices.updated_at THEN EXCLUDED.last_price
            ELSE user_product_prices.last_price
          END,
          updated_at = GREATEST(user_product_prices.updated_at, EXCLUDED.updated_at)
        `,
        [noStoreId, sid],
      );

      const delOld = await client.query(
        `DELETE FROM user_product_prices WHERE store_id = $1 RETURNING id`,
        [sid],
      );
      uppMoved = delOld.rowCount;
    }

    const psInserted = await client.query(
      `
      INSERT INTO product_store (product_id, store_id)
      SELECT product_id, $1
      FROM product_store
      WHERE store_id = $2
      ON CONFLICT (product_id, store_id) DO NOTHING
      `,
      [noStoreId, sid],
    );

    const psDeleted = await client.query(
      `DELETE FROM product_store WHERE store_id = $1 RETURNING product_id`,
      [sid],
    );

    const delStore = await client.query(
      `DELETE FROM stores WHERE id = $1 AND is_system = false AND owner_user_id = $2`,
      [sid, uid],
    );

    await client.query("COMMIT");

    return {
      deleted: delStore.rowCount > 0,
      migrated_to_store_id: noStoreId,
      migrated_counts: {
        shopping_list_items: sli.rowCount,
        user_products: up.rowCount,
        user_product_prices_moved: uppMoved,
        user_product_prices_deleted: uppDeleted,
        product_store_links_migrated_inserted: psInserted.rowCount,
        product_store_links_removed_from_deleted_store: psDeleted.rowCount,
        product_store_links_ensured_for_user_products: ensuredProductStoreLinks,
      },
    };
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("safe delete store error:", e);
    if (e.statusCode) throw e;
    const err = new Error("Server error deleting store safely");
    err.statusCode = 500;
    throw err;
  } finally {
    client.release();
  }
}

export default {
  safeDeleteUserStore,
};