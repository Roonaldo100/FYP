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

function normalizeProductName(name) {
  const s = String(name || "").trim();
  if (!s) return null;
  return s.slice(0, 30);
}

export async function searchProducts({ q, userId, limit, offset }) {
  const searchTerm = String(q || "").trim();
  const uid = parseOptionalUserId(userId);

  const limitNum = Math.min(Math.max(Number(limit ?? 25), 1), 50);
  const offsetNum = Math.max(Number(offset ?? 0), 0);

  if (!searchTerm && !uid) return [];

  try {
    if (uid) {
      if (!searchTerm) {
        const r = await pool.query(
          `
          SELECT id, name, food_type, is_system, owner_user_id
          FROM products
          WHERE (is_system = true OR owner_user_id = $1)
          ORDER BY id DESC
          LIMIT $2 OFFSET $3
          `,
          [uid, limitNum, offsetNum],
        );

        return r.rows.map((row) => ({
          id: Number(row.id),
          name: String(row.name),
          food_type: row.food_type != null ? Number(row.food_type) : null,
          is_system: Boolean(row.is_system),
          owner_user_id: row.owner_user_id ?? null,
        }));
      }

      const r = await pool.query(
        `
        SELECT id, name, food_type, is_system, owner_user_id
        FROM products
        WHERE (is_system = true OR owner_user_id = $1)
          AND name ILIKE $2
        ORDER BY
          CASE WHEN owner_user_id = $1 THEN 0 ELSE 1 END,
          name ASC
        LIMIT $3 OFFSET $4
        `,
        [uid, `%${searchTerm}%`, limitNum, offsetNum],
      );

      return r.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        food_type: row.food_type != null ? Number(row.food_type) : null,
        is_system: Boolean(row.is_system),
        owner_user_id: row.owner_user_id ?? null,
      }));
    }

    const r = await pool.query(
      `
      SELECT id, name
      FROM products
      WHERE is_system = true
        AND name ILIKE $1
      ORDER BY name ASC
      LIMIT $2 OFFSET $3
      `,
      [`%${searchTerm}%`, limitNum, offsetNum],
    );

    return r.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
    }));
  } catch (e) {
    console.error("Product search error:", e);
    const err = new Error("Server error searching products");
    err.statusCode = 500;
    throw err;
  }
}

export async function createProduct({
  userId,
  name,
  barcode,
  foodTypeId,
  storeId,
  allowExisting,
}) {
  const uid = parseOptionalUserId(userId);
  const normalizedName = normalizeProductName(name);

  if (!uid) {
    const err = new Error(
      "Missing userId (required after scoped products update)",
    );
    err.statusCode = 400;
    throw err;
  }

  if (!normalizedName || !foodTypeId) {
    const err = new Error("Missing required fields");
    err.statusCode = 400;
    throw err;
  }

  try {
    const ft = await pool.query(
      `
      SELECT id
      FROM food_types
      WHERE id = $1
        AND (is_system = true OR owner_user_id = $2)
      LIMIT 1
      `,
      [foodTypeId, uid],
    );

    if (ft.rows.length === 0) {
      const err = new Error("Invalid food type for this user");
      err.statusCode = 400;
      throw err;
    }

    if (barcode) {
      const existing = await pool.query(
        `
        SELECT id, name
        FROM products
        WHERE barcode = $1
          AND (is_system = true OR owner_user_id = $2)
        LIMIT 1
        `,
        [barcode, uid],
      );

      if (existing.rows.length > 0) {
        const allowExistingFlag = allowExisting === true;

        if (!allowExistingFlag) {
          return {
            barcode_conflict: true,
            existing_product_id: existing.rows[0].id,
            existing_product_name: existing.rows[0].name,
          };
        }

        let storeName = null;
        if (storeId) {
          const storeNameRes = await pool.query(
            `SELECT name FROM stores WHERE id = $1 LIMIT 1`,
            [storeId],
          );
          storeName = storeNameRes.rows[0]?.name ?? null;
        }

        return {
          product_id: existing.rows[0].id,
          product_name: existing.rows[0].name,
          store_id: storeId ?? null,
          store_name: storeName,
        };
      }
    }

    const insertProduct = await pool.query(
      `
      INSERT INTO products (name, barcode, food_type, is_system, owner_user_id)
      VALUES ($1, $2, $3, false, $4)
      RETURNING id
      `,
      [normalizedName, barcode ?? null, foodTypeId, uid],
    );

    const newProductId = insertProduct.rows[0].id;

    if (storeId) {
      const storeOk = await pool.query(
        `
        SELECT id
        FROM stores
        WHERE id = $1 AND (is_system = true OR owner_user_id = $2)
        LIMIT 1
        `,
        [storeId, uid],
      );

      if (storeOk.rows.length) {
        try {
          await pool.query(
            `
            INSERT INTO product_store (product_id, store_id)
            VALUES ($1, $2)
            ON CONFLICT (product_id, store_id) DO NOTHING
            `,
            [newProductId, storeId],
          );
        } catch {}
      }
    }

    let storeName = null;
    if (storeId) {
      const storeNameRes = await pool.query(
        `SELECT name FROM stores WHERE id = $1 LIMIT 1`,
        [storeId],
      );
      storeName = storeNameRes.rows[0]?.name ?? null;
    }

    return {
      product_id: newProductId,
      product_name: normalizedName,
      store_id: storeId ?? null,
      store_name: storeName,
    };
  } catch (err) {
    console.error("Create product error:", err);
    if (err.statusCode) throw err;

    const error = new Error("Server error creating product");
    error.statusCode = 500;
    throw error;
  }
}

export default {
  searchProducts,
  createProduct,
};