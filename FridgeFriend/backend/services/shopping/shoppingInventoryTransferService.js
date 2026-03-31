 import pool from "../../db.js";

export async function addSelectedListItemsToInventory(userId, listId, itemIds) {
  const uid = Number(userId);
  const lid = Number(listId);

  const cleanIds = Array.isArray(itemIds)
    ? itemIds.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0)
    : [];

  if (
    !Number.isInteger(uid) ||
    uid <= 0 ||
    !Number.isInteger(lid) ||
    lid <= 0
  ) {
    const err = new Error("Invalid userId or listId");
    err.statusCode = 400;
    throw err;
  }

  if (!cleanIds.length) {
    return { added_inventory_rows: 0 };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const itemsRes = await client.query(
      `
      SELECT id, product_id, store_id, quantity, expiry_date
      FROM shopping_list_items
      WHERE list_id = $1
        AND id = ANY($2::int[])
        AND product_id IS NOT NULL
      `,
      [lid, cleanIds],
    );

    let added = 0;

    for (const row of itemsRes.rows) {
      const productId = Number(row.product_id);
      const storeId = row.store_id == null ? null : Number(row.store_id);
      const expiryDate = row.expiry_date ?? null;
      const qty = Math.max(1, Number(row.quantity || 1));

      for (let i = 0; i < qty; i++) {
        await client.query(
          `
          INSERT INTO user_products (
            user_id,
            product_id,
            store_id,
            expiry_date,
            expiry_period_days,
            notified
          )
          VALUES ($1, $2, $3, $4, 0, false)
          `,
          [uid, productId, storeId, expiryDate],
        );
        added++;
      }
    }

    await client.query("COMMIT");
    return { added_inventory_rows: added };
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("addToInventory error:", e);
    const err = new Error("Server error adding to inventory");
    err.statusCode = 500;
    throw err;
  } finally {
    client.release();
  }
}

export default {
  addSelectedListItemsToInventory,
};