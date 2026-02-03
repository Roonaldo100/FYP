import cors from "cors";
import express from "express";
import fetch from "node-fetch";
import pool from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Helpers
 */
async function getTescoStoreId() {
  try {
    const r = await pool.query(
      `SELECT id FROM stores WHERE LOWER(name) = 'tesco' LIMIT 1`
    );
    if (r.rows.length > 0) return r.rows[0].id;
  } catch (e) {
    console.warn("getTescoStoreId error:", e?.message ?? e);
  }
  return 1; // fallback
}

async function getNoStoreId() {
  const noStoreName = "No store";

  try {
    const r = await pool.query(
      `SELECT id FROM stores WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [noStoreName]
    );
    if (r.rows.length > 0) return r.rows[0].id;

    const inserted = await pool.query(
      `INSERT INTO stores (name) VALUES ($1) RETURNING id`,
      [noStoreName]
    );
    return inserted.rows[0].id;
  } catch (e) {
    console.warn("getNoStoreId error:", e?.message ?? e);
    // As a fallback, use Tesco if something is badly wrong
    return await getTescoStoreId();
  }
}


/**
 * GET: Categories
 */
app.get("/categories", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM categories ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error("Categories error:", err);
    res.status(500).json({ message: "Server error loading categories" });
  }
});

/**
 * GET: Food types by category
 */
app.get("/categories/:id/food", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM food_types WHERE category = $1 ORDER BY id",
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Food types error:", err);
    res.status(500).json({ message: "Server error loading food types" });
  }
});

/**
 * GET: Stores
 */
app.get("/stores", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM stores ORDER BY name ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Store fetch error:", err);
    res.status(500).json({ message: "Server error loading stores" });
  }
});

/**
 * POST: Create a new store (for on-the-fly store creation)
 * Body: { name }
 */
app.post("/stores", async (req, res) => {
  const { name } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Missing store name" });
  }

  const cleaned = String(name).trim();

  try {
    // Try to reuse an existing store by case-insensitive match
    const existing = await pool.query(
      `SELECT id, name FROM stores WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [cleaned]
    );

    if (existing.rows.length > 0) {
      return res.json({
        store_id: existing.rows[0].id,
        store_name: existing.rows[0].name,
        reused: true,
      });
    }

    const inserted = await pool.query(
      `INSERT INTO stores (name) VALUES ($1) RETURNING id, name`,
      [cleaned]
    );

    res.json({
      store_id: inserted.rows[0].id,
      store_name: inserted.rows[0].name,
      reused: false,
    });
  } catch (err) {
    console.error("Create store error:", err);
    res.status(500).json({ message: "Server error creating store" });
  }
});

/**
 * POST: Scan barcode
 *
 * If product exists locally, store is optional:
 * - If a product_store relationship exists, return that store
 * - Otherwise return store_id=null/store_name=null
 *
 * If OFF finds it but it's not in DB, we DO NOT create it locally anymore.
 * Instead, we return needs_classification=true so the app can ask the user
 * to choose Category + Food Type before creating the product.
 */
app.post("/scan", async (req, res) => {
  const { barcode } = req.body;
  if (!barcode) {
    return res.status(400).json({ found: false, message: "Missing barcode" });
  }

  try {
    // 1) Local DB lookup
    const localProduct = await pool.query(
      `SELECT id, name FROM products WHERE barcode = $1 LIMIT 1`,
      [barcode]
    );

    if (localProduct.rows.length > 0) {
      const product = localProduct.rows[0];

      // Try to find a store via product_store, else return null store
      const storeJoin = await pool.query(
        `
        SELECT s.id AS store_id, s.name AS store_name
        FROM product_store ps
        JOIN stores s ON s.id = ps.store_id
        WHERE ps.product_id = $1
        ORDER BY s.name ASC
        LIMIT 1
        `,
        [product.id]
      );

      if (storeJoin.rows.length > 0) {
        return res.json({
          found: true,
          product_id: product.id,
          product_name: product.name,
          store_id: storeJoin.rows[0].store_id,
          store_name: storeJoin.rows[0].store_name,
        });
      }

      return res.json({
        found: true,
        product_id: product.id,
        product_name: product.name,
        store_id: null,
        store_name: null,
      });
    }

    // 2) Not in local DB, try Open Food Facts
    const offRes = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
    const offData = await offRes.json();

    if (!offData || offData.status === 0) return res.json({ found: false });

    const name =
      offData.product?.product_name ||
      offData.product?.generic_name ||
      "Unnamed Product";

    // New behaviour: let the client classify the product before creating it in DB
    return res.json({
      found: true,
      product_id: null,
      product_name: name,
      store_id: null,
      store_name: null,
      needs_classification: true,
      barcode,
    });
  } catch (err) {
    console.error("Scan error:", err);
    res.status(500).json({ found: false, message: "Server error while scanning" });
  }
});

/**
 * POST: Create a product after user classification (Category + Food Type chosen)
 * Body: { name, barcode, foodTypeId, storeId }
 *
 * storeId is optional. If omitted/null, no product_store row is created.
 */
app.post("/products/create", async (req, res) => {
  const { name, barcode, foodTypeId, storeId } = req.body;

  if (!name || !foodTypeId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Ensure the food type exists
    const ft = await pool.query(`SELECT id FROM food_types WHERE id = $1 LIMIT 1`, [
      foodTypeId,
    ]);
    if (ft.rows.length === 0) {
      return res.status(400).json({ message: "Invalid food type" });
    }

    // Prevent accidental reuse: if barcode exists, require explicit confirmation
    if (barcode) {
      const existing = await pool.query(
        `SELECT id, name FROM products WHERE barcode = $1 LIMIT 1`,
        [barcode]
      );

      if (existing.rows.length > 0) {
        const allowExisting = req.body.allowExisting === true;

        if (!allowExisting) {
          return res.json({
            barcode_conflict: true,
            existing_product_id: existing.rows[0].id,
            existing_product_name: existing.rows[0].name,
          });
        }

        // User explicitly confirmed they want to use the existing DB product
        return res.json({
          product_id: existing.rows[0].id,
          product_name: existing.rows[0].name,
          store_id: storeId ?? null,
          store_name: null,
        });
      }
    }



    const insertProduct = await pool.query(
      `INSERT INTO products (name, barcode, food_type)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [name, barcode ?? null, foodTypeId]
    );

    const newProductId = insertProduct.rows[0].id;

    // Attach store relationship only if a storeId was provided
    if (storeId) {
      try {
        await pool.query(
          `
          INSERT INTO product_store (product_id, store_id, price)
          VALUES ($1, $2, $3)
          ON CONFLICT (product_id, store_id) DO NOTHING
          `,
          [newProductId, storeId, 0.0]
        );
      } catch {}
    }

    let storeName = null;
    if (storeId) {
      const storeNameRes = await pool.query(
        `SELECT name FROM stores WHERE id = $1 LIMIT 1`,
        [storeId]
      );
      storeName = storeNameRes.rows[0]?.name ?? null;
    }

    return res.json({
      product_id: newProductId,
      product_name: name,
      store_id: storeId ?? null,
      store_name: storeName,
    });
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ message: "Server error creating product" });
  }
});

/**
 * POST: Add product to user inventory
 * storeId and expiryDate are optional. Missing fields will insert NULL.
 *
 * returns user_product_id AND days_left AND effective_period_days (days_left null if no expiry date)
 */
app.post("/user/addProduct", async (req, res) => {
  const { userId, productId, storeId, expiryDate } = req.body;

  if (!userId || !productId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Treat "no store" as a real store id
    const effectiveStoreId = storeId ? Number(storeId) : await getNoStoreId();

    // Ensure product_store row exists for this product/store pair to satisfy FK
    await pool.query(
      `
      INSERT INTO product_store (product_id, store_id, price)
      VALUES ($1, $2, $3)
      ON CONFLICT (product_id, store_id) DO NOTHING
      `,
      [productId, effectiveStoreId, 0.0]
    );

    const inserted = await pool.query(
      `
      INSERT INTO user_products (user_id, product_id, store_id, expiry_date, expiry_period_days, notified)
      VALUES ($1, $2, $3, $4, 0, false)
      RETURNING id, expiry_period_days, expiry_date
      `,
      [userId, productId, effectiveStoreId, expiryDate ?? null]
    );

    const upRow = inserted.rows[0];

    const userPrefRes = await pool.query(
      `SELECT notification_period_preference FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    const userPref = userPrefRes.rows.length
      ? Number(userPrefRes.rows[0].notification_period_preference ?? 0)
      : 0;

    let days_left = null;
    if (upRow.expiry_date) {
      const daysLeftRes = await pool.query(
        `SELECT ($1::date - CURRENT_DATE) AS days_left`,
        [upRow.expiry_date]
      );
      days_left = Number(daysLeftRes.rows[0].days_left);
    }

    const expiry_period_days = Number(upRow.expiry_period_days ?? 0);
    const effective_period_days =
      expiry_period_days > 0 ? expiry_period_days : userPref;

    res.json({
      message: "Product added successfully",
      user_product_id: upRow.id,
      expiry_period_days,
      effective_period_days,
      days_left,
    });
  } catch (err) {
    console.error("Add product error:", err);
    res.status(500).json({ message: "Server error adding product" });
  }
});


/**
 * POST: Remove N items from user_products for a grouped product/store row
 * Body: { userId, productId, storeId, quantity }
 *
 * storeId can be null. We match using IS NOT DISTINCT FROM to support null.
 */
app.post("/user_products/remove", async (req, res) => {
  const { userId, productId, storeId, quantity } = req.body;

  const qty = Number(quantity);

  if (!userId || !productId || !qty || qty <= 0) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
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
      [userId, productId, storeId ?? null, qty]
    );

    res.json({ removed: del.rowCount });
  } catch (err) {
    console.error("Remove user_products error:", err);
    res.status(500).json({ message: "Server error removing items" });
  }
});

/**
 * POST: Mark a user_products row as notified=true
 */
app.post("/user_products/:id/markNotified", async (req, res) => {
  const { id } = req.params;

  try {
    const updated = await pool.query(
      `
      UPDATE user_products
      SET notified = true
      WHERE id = $1
      RETURNING id, notified
      `,
      [id]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ message: "user_products row not found" });
    }

    res.json({ message: "Marked as notified", row: updated.rows[0] });
  } catch (err) {
    console.error("Mark notified error:", err);
    res.status(500).json({ message: "Server error marking notified" });
  }
});

/**
 * GET: Pending notifications (DB decides using user preference + per-item override)
 *
 * Expiry date is required to be considered pending. Rows with expiry_date NULL are ignored.
 */
app.get("/user/:userId/pendingNotifications", async (req, res) => {
  const { userId } = req.params;

  try {
    const r = await pool.query(
      `
      SELECT
        up.id AS user_product_id,
        p.name AS product_name,
        (up.expiry_date::date - CURRENT_DATE) AS days_left,
        COALESCE(up.expiry_period_days, u.notification_period_preference, 0) AS effective_period_days
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      JOIN users u ON u.id = up.user_id
      WHERE up.user_id = $1
        AND up.notified = false
        AND up.expiry_date IS NOT NULL
        AND (up.expiry_date::date - CURRENT_DATE)
            <= COALESCE(up.expiry_period_days, u.notification_period_preference, 0)
      ORDER BY up.id ASC
      LIMIT 50;
      `,
      [userId]
    );

    const rows = r.rows.map((row) => ({
      ...row,
      days_left: Number(row.days_left),
      effective_period_days: Number(row.effective_period_days),
    }));

    res.json(rows);
  } catch (err) {
    console.error("Pending notifications error:", err);
    res
      .status(500)
      .json({ message: "Server error loading pending notifications" });
  }
});

/**
 * GET: User products by food type
 * Store and expiry date are optional, so this uses LEFT JOIN and allows nearest_expiry to be null.
 */
app.get("/user/:userId/foodtype/:foodTypeId", async (req, res) => {
  const { userId, foodTypeId } = req.params;

  try {
    const q = `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        s.id AS store_id,
        s.name AS store_name,
        COUNT(up.id) AS quantity,
        MIN(up.expiry_date) AS nearest_expiry
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      LEFT JOIN stores s ON s.id = up.store_id
      WHERE up.user_id = $1 AND p.food_type = $2
      GROUP BY p.id, p.name, s.id, s.name
      ORDER BY p.name;
    `;

    const result = await pool.query(q, [userId, foodTypeId]);
    res.json(result.rows);
  } catch (err) {
    console.error("User product fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * LOGIN
 */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const r = await pool.query(
      "SELECT * FROM users WHERE username = $1 AND password = $2",
      [username, password]
    );

    if (r.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      user_id: r.rows[0].id,
      username: r.rows[0].username,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
