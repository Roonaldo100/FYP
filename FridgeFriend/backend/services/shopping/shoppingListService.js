import pool from "../../db.js";
import {
  cleanListName,
  cleanCustomItemName,
} from "../../utils/shopping/shoppingUtils.js";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function toPositiveInt(v, fallback = null) {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

function parseOptionalExpiryDate(raw) {
  if (raw === undefined) return undefined;
  if (raw === null) return null;

  const s = String(raw).trim();
  if (!s) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new HttpError(400, "Invalid expiryDate");
  }

  return s;
}

async function assertUserOwnsList(userId, listId) {
  const r = await pool.query(
    `SELECT id, user_id, name, created_at, updated_at FROM shopping_lists WHERE id = $1 LIMIT 1`,
    [listId],
  );
  const row = r.rows[0] || null;
  if (!row) throw new HttpError(404, "Shopping list not found");
  if (Number(row.user_id) !== Number(userId)) {
    throw new HttpError(403, "Not your shopping list");
  }
  return row;
}

async function assertStoreVisibleToUser(userId, storeId) {
  if (storeId === null || storeId === undefined) return true;

  const r = await pool.query(
    `
    SELECT id
    FROM stores
    WHERE id = $1
      AND (is_system = true OR owner_user_id = $2)
    LIMIT 1
    `,
    [storeId, userId],
  );

  if (!r.rows.length) throw new HttpError(400, "Invalid store for this user");
  return true;
}

async function assertProductVisibleToUser(userId, productId) {
  const r = await pool.query(
    `
    SELECT id
    FROM products
    WHERE id = $1
      AND (is_system = true OR owner_user_id = $2)
    LIMIT 1
    `,
    [productId, userId],
  );
  if (!r.rows.length) throw new HttpError(400, "Invalid product for this user");
  return true;
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

export async function createShoppingList(userId, name) {
  const uid = Number(userId);
  const cleanedName = cleanListName(name);

  if (!Number.isInteger(uid) || uid <= 0) {
    const err = new Error("Invalid userId");
    err.statusCode = 400;
    throw err;
  }
  if (!cleanedName) {
    const err = new Error("Missing list name");
    err.statusCode = 400;
    throw err;
  }

  try {
    const ins = await pool.query(
      `
      INSERT INTO shopping_lists (user_id, name)
      VALUES ($1, $2)
      RETURNING id
      `,
      [uid, cleanedName],
    );

    return { list_id: Number(ins.rows[0].id) };
  } catch (e) {
    console.error("create shopping list error:", e);
    const err = new Error("Server error creating shopping list");
    err.statusCode = 500;
    throw err;
  }
}

export async function listShoppingLists(userId) {
  const uid = Number(userId);

  if (!Number.isInteger(uid) || uid <= 0) {
    const err = new Error("Invalid userId");
    err.statusCode = 400;
    throw err;
  }

  try {
    const r = await pool.query(
      `
      SELECT id, name, created_at, updated_at
      FROM shopping_lists
      WHERE user_id = $1
      ORDER BY updated_at DESC, id DESC
      LIMIT 200
      `,
      [uid],
    );

    return r.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (e) {
    console.error("list shopping lists error:", e);
    const err = new Error("Server error listing shopping lists");
    err.statusCode = 500;
    throw err;
  }
}

export async function deleteShoppingList(userId, listId) {
  const uid = Number(userId);
  const lid = Number(listId);

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

  try {
    await assertUserOwnsList(uid, lid);

    await pool.query(
      `DELETE FROM shopping_lists WHERE id = $1 AND user_id = $2`,
      [lid, uid],
    );

    return { deleted: true };
  } catch (e) {
    if (e.status) {
      e.statusCode = e.status;
      throw e;
    }
    console.error("delete shopping list error:", e);
    const err = new Error("Server error deleting shopping list");
    err.statusCode = 500;
    throw err;
  }
}

export async function addShoppingListItem(userId, listId, body) {
  const uid = Number(userId);
  const lid = Number(listId);

  const productId =
    body?.productId != null && String(body.productId).trim() !== ""
      ? Number(body.productId)
      : null;

  const customName =
    body?.customName != null ? cleanCustomItemName(body.customName) : null;

  const storeIdRaw = body?.storeId;
  const storeId =
    storeIdRaw === undefined || storeIdRaw === null || String(storeIdRaw) === ""
      ? null
      : Number(storeIdRaw);

  const quantity = toPositiveInt(body?.quantity, 1) ?? 1;
  const expiryDate = parseOptionalExpiryDate(body?.expiryDate);

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

  if (!productId && !customName) {
    const err = new Error("Provide productId or customName");
    err.statusCode = 400;
    throw err;
  }
  if (productId && customName) {
    const err = new Error("Provide either productId OR customName, not both");
    err.statusCode = 400;
    throw err;
  }

  if (storeId !== null && (!Number.isInteger(storeId) || storeId <= 0)) {
    const err = new Error("Invalid storeId");
    err.statusCode = 400;
    throw err;
  }

  try {
    await assertUserOwnsList(uid, lid);

    if (storeId !== null) {
      await assertStoreVisibleToUser(uid, storeId);
    }

    if (productId !== null) {
      await assertProductVisibleToUser(uid, productId);
    }

    if (productId && storeId !== null) {
      await pool.query(
        `
        INSERT INTO product_store (product_id, store_id)
        VALUES ($1, $2)
        ON CONFLICT (product_id, store_id) DO NOTHING
        `,
        [productId, storeId],
      );
    }

    let existing = null;

    if (productId !== null) {
      const r = await pool.query(
        `
        SELECT id, quantity
        FROM shopping_list_items
        WHERE list_id = $1
          AND product_id = $2
          AND store_id IS NOT DISTINCT FROM $3
          AND expiry_date IS NOT DISTINCT FROM $4::date
        LIMIT 1
        `,
        [lid, productId, storeId, expiryDate ?? null],
      );
      existing = r.rows[0] || null;
    } else {
      const r = await pool.query(
        `
        SELECT id, quantity
        FROM shopping_list_items
        WHERE list_id = $1
          AND product_id IS NULL
          AND LOWER(custom_name) = LOWER($2)
          AND store_id IS NOT DISTINCT FROM $3
          AND expiry_date IS NOT DISTINCT FROM $4::date
        LIMIT 1
        `,
        [lid, customName, storeId, expiryDate ?? null],
      );
      existing = r.rows[0] || null;
    }

    if (existing) {
      await pool.query(
        `
        UPDATE shopping_list_items
        SET quantity = quantity + $1
        WHERE id = $2
        `,
        [quantity, Number(existing.id)],
      );

      await pool.query(
        `UPDATE shopping_lists SET updated_at = now() WHERE id = $1`,
        [lid],
      );

      if (productId) {
        await bumpProductUsage(pool, uid, productId, "shopping");
      }

      return {
        item_id: Number(existing.id),
        merged: true,
        statusCode: 200,
      };
    }

    const ins = await pool.query(
      `
      INSERT INTO shopping_list_items (
        list_id,
        product_id,
        custom_name,
        store_id,
        quantity,
        expiry_date
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [lid, productId, customName, storeId, quantity, expiryDate ?? null],
    );

    await pool.query(
      `UPDATE shopping_lists SET updated_at = now() WHERE id = $1`,
      [lid],
    );

    if (productId) {
      await bumpProductUsage(pool, uid, productId, "shopping");
    }

    return {
      item_id: Number(ins.rows[0].id),
      merged: false,
      statusCode: 201,
    };
  } catch (e) {
    if (e.status) {
      e.statusCode = e.status;
      throw e;
    }
    if (e.statusCode) throw e;
    console.error("add shopping list item error:", e);
    const err = new Error("Server error adding item");
    err.statusCode = 500;
    throw err;
  }
}

export async function attachProductToShoppingListItem(
  userId,
  listId,
  itemId,
  body,
) {
  const uid = Number(userId);
  const lid = Number(listId);
  const iid = Number(itemId);

  const productId =
    body?.productId != null && String(body.productId).trim() !== ""
      ? Number(body.productId)
      : null;

  const storeIdRaw = body?.storeId;
  const storeId =
    storeIdRaw === undefined || storeIdRaw === null || String(storeIdRaw) === ""
      ? null
      : Number(storeIdRaw);

  if (
    !Number.isInteger(uid) ||
    uid <= 0 ||
    !Number.isInteger(lid) ||
    lid <= 0 ||
    !Number.isInteger(iid) ||
    iid <= 0
  ) {
    const err = new Error("Invalid ids");
    err.statusCode = 400;
    throw err;
  }

  if (!Number.isInteger(productId) || productId <= 0) {
    const err = new Error("Invalid productId");
    err.statusCode = 400;
    throw err;
  }

  if (storeId !== null && (!Number.isInteger(storeId) || storeId <= 0)) {
    const err = new Error("Invalid storeId");
    err.statusCode = 400;
    throw err;
  }

  try {
    await assertUserOwnsList(uid, lid);
    await assertProductVisibleToUser(uid, productId);

    if (storeId !== null) {
      await assertStoreVisibleToUser(uid, storeId);
      await pool.query(
        `
        INSERT INTO product_store (product_id, store_id)
        VALUES ($1, $2)
        ON CONFLICT (product_id, store_id) DO NOTHING
        `,
        [productId, storeId],
      );
    }

    const upd = await pool.query(
      `
      UPDATE shopping_list_items
      SET product_id = $1,
          custom_name = NULL,
          store_id = $2
      WHERE id = $3
        AND list_id = $4
      RETURNING id
      `,
      [productId, storeId, iid, lid],
    );

    if (!upd.rows.length) {
      throw new HttpError(404, "Item not found");
    }

    await pool.query(
      `UPDATE shopping_lists SET updated_at = now() WHERE id = $1`,
      [lid],
    );

    await bumpProductUsage(pool, uid, productId, "shopping");

    return { updated: true };
  } catch (e) {
    if (e.status) {
      e.statusCode = e.status;
      throw e;
    }
    if (e.statusCode) throw e;
    console.error("attach shopping list item error:", e);
    const err = new Error("Server error attaching product");
    err.statusCode = 500;
    throw err;
  }
}

export async function updateShoppingListItem(userId, listId, itemId, payload) {
  const uid = Number(userId);
  const lid = Number(listId);
  const iid = Number(itemId);

  const quantityProvided = Object.prototype.hasOwnProperty.call(payload || {}, "quantity");
  const storeProvided = Object.prototype.hasOwnProperty.call(payload || {}, "storeId");
  const expiryProvided = Object.prototype.hasOwnProperty.call(payload || {}, "expiryDate");

  const quantity = quantityProvided ? toPositiveInt(payload?.quantity, null) : null;

  const storeId =
    !storeProvided
      ? undefined
      : payload?.storeId === null || payload?.storeId === undefined || String(payload?.storeId) === ""
        ? null
        : Number(payload.storeId);

  const expiryDate = parseOptionalExpiryDate(payload?.expiryDate);

  if (
    !Number.isInteger(uid) ||
    uid <= 0 ||
    !Number.isInteger(lid) ||
    lid <= 0 ||
    !Number.isInteger(iid) ||
    iid <= 0
  ) {
    const err = new Error("Invalid ids");
    err.statusCode = 400;
    throw err;
  }

  if (quantityProvided && quantity === null) {
    const err = new Error("Invalid quantity");
    err.statusCode = 400;
    throw err;
  }

  if (
    storeProvided &&
    storeId !== null &&
    (!Number.isInteger(storeId) || storeId <= 0)
  ) {
    const err = new Error("Invalid storeId");
    err.statusCode = 400;
    throw err;
  }

  try {
    await assertUserOwnsList(uid, lid);

    const currentRes = await pool.query(
      `
      SELECT id, product_id
      FROM shopping_list_items
      WHERE id = $1 AND list_id = $2
      LIMIT 1
      `,
      [iid, lid],
    );

    const current = currentRes.rows[0] || null;
    if (!current) {
      throw new HttpError(404, "Item not found");
    }

    const productId = current.product_id != null ? Number(current.product_id) : null;

    if (storeProvided && storeId !== null) {
      await assertStoreVisibleToUser(uid, storeId);
    }

    const updates = [];
    const params = [];
    let i = 1;

    if (storeProvided) {
      updates.push(`store_id = $${i++}`);
      params.push(storeId);
    }

    if (quantityProvided) {
      updates.push(`quantity = $${i++}`);
      params.push(quantity);
    }

    if (expiryProvided) {
      updates.push(`expiry_date = $${i++}`);
      params.push(expiryDate ?? null);
    }

    if (!updates.length) return { updated: true };

    if (storeProvided && productId && storeId !== null) {
      await pool.query(
        `
        INSERT INTO product_store (product_id, store_id)
        VALUES ($1, $2)
        ON CONFLICT (product_id, store_id) DO NOTHING
        `,
        [productId, storeId],
      );
    }

    params.push(iid, lid);

    await pool.query(
      `
      UPDATE shopping_list_items
      SET ${updates.join(", ")}
      WHERE id = $${i++} AND list_id = $${i++}
      `,
      params,
    );

    await pool.query(
      `UPDATE shopping_lists SET updated_at = now() WHERE id = $1`,
      [lid],
    );

    return { updated: true };
  } catch (e) {
    if (e.status) {
      e.statusCode = e.status;
      throw e;
    }
    if (e.statusCode) throw e;
    console.error("update shopping list item error:", e);
    const err = new Error("Server error updating item");
    err.statusCode = 500;
    throw err;
  }
}

export async function deleteShoppingListItem(userId, listId, itemId) {
  const uid = Number(userId);
  const lid = Number(listId);
  const iid = Number(itemId);

  if (
    !Number.isInteger(uid) ||
    uid <= 0 ||
    !Number.isInteger(lid) ||
    lid <= 0 ||
    !Number.isInteger(iid) ||
    iid <= 0
  ) {
    const err = new Error("Invalid ids");
    err.statusCode = 400;
    throw err;
  }

  try {
    await assertUserOwnsList(uid, lid);

    const del = await pool.query(
      `DELETE FROM shopping_list_items WHERE id = $1 AND list_id = $2`,
      [iid, lid],
    );

    if (del.rowCount === 0) throw new HttpError(404, "Item not found");

    return { deleted: true };
  } catch (e) {
    if (e.status) {
      e.statusCode = e.status;
      throw e;
    }
    if (e.statusCode) throw e;
    console.error("delete shopping list item error:", e);
    const err = new Error("Server error deleting item");
    err.statusCode = 500;
    throw err;
  }
}

export async function getShoppingList(userId, listId) {
  const uid = Number(userId);
  const lid = Number(listId);

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

  try {
    const list = await assertUserOwnsList(uid, lid);

    const r = await pool.query(
      `
      SELECT
        sli.id AS item_id,
        sli.product_id,
        sli.custom_name,
        sli.store_id,
        sli.quantity,
        sli.expiry_date,
        p.name AS product_name,
        s.name AS store_name,
        upp.last_price AS unit_price
      FROM shopping_list_items sli
      LEFT JOIN products p ON p.id = sli.product_id
      LEFT JOIN stores s ON s.id = sli.store_id
      LEFT JOIN user_product_prices upp
        ON upp.user_id = $1
       AND upp.product_id = sli.product_id
       AND upp.store_id IS NOT DISTINCT FROM sli.store_id
      WHERE sli.list_id = $2
      ORDER BY
        sli.store_id NULLS LAST,
        COALESCE(s.name, '') ASC,
        COALESCE(p.name, sli.custom_name) ASC,
        sli.id ASC
      `,
      [uid, lid],
    );

    const items = r.rows.map((row) => {
      const name = row.product_id
        ? String(row.product_name ?? "")
        : String(row.custom_name ?? "");
      const unitPrice = row.unit_price != null ? Number(row.unit_price) : null;
      const qty = Number(row.quantity ?? 1);

      const hasKnownPrice =
        row.product_id != null &&
        unitPrice != null &&
        Number.isFinite(unitPrice);

      const lineTotal = hasKnownPrice ? unitPrice * qty : null;

      return {
        id: Number(row.item_id),
        product_id: row.product_id != null ? Number(row.product_id) : null,
        custom_name: row.custom_name ?? null,
        name,
        store_id: row.store_id != null ? Number(row.store_id) : null,
        store_name: row.store_id != null ? (row.store_name ?? null) : null,
        quantity: qty,
        expiry_date: row.expiry_date ?? null,
        unit_price: hasKnownPrice ? unitPrice : null,
        line_total: lineTotal,
      };
    });

    const groupsMap = new Map();

    for (const it of items) {
      const key = it.store_id === null ? "nostore" : String(it.store_id);
      const storeName =
        it.store_id === null ? "No store" : (it.store_name ?? "Store");

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          store_id: it.store_id,
          store_name: storeName,
          items: [],
          subtotal_known: 0,
          unknown_count: 0,
        });
      }

      const g = groupsMap.get(key);
      g.items.push(it);

      if (it.line_total != null && Number.isFinite(it.line_total)) {
        g.subtotal_known += Number(it.line_total);
      } else {
        g.unknown_count += 1;
      }
    }

    const groups = Array.from(groupsMap.values()).sort((a, b) => {
      if (a.store_id === null && b.store_id !== null) return 1;
      if (a.store_id !== null && b.store_id === null) return -1;
      return String(a.store_name).localeCompare(String(b.store_name));
    });

    let total_known_price = 0;
    let unknown_price_count = 0;

    for (const g of groups) {
      total_known_price += Number(g.subtotal_known || 0);
      unknown_price_count += Number(g.unknown_count || 0);
    }

    return {
      list: {
        id: Number(list.id),
        name: String(list.name),
        created_at: list.created_at,
        updated_at: list.updated_at,
      },
      groups,
      total_known_price,
      unknown_price_count,
    };
  } catch (e) {
    if (e.status) {
      e.statusCode = e.status;
      throw e;
    }
    if (e.statusCode) throw e;
    console.error("get shopping list error:", e);
    const err = new Error("Server error loading shopping list");
    err.statusCode = 500;
    throw err;
  }
}

export default {
  createShoppingList,
  listShoppingLists,
  deleteShoppingList,
  addShoppingListItem,
  attachProductToShoppingListItem,
  updateShoppingListItem,
  deleteShoppingListItem,
  getShoppingList,
};