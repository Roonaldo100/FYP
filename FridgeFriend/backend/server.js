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
    const result = await pool.query("SELECT * FROM stores ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error("Store fetch error:", err);
    res.status(500).json({ message: "Server error loading stores" });
  }
});

/**
 * POST: Scan barcode
 *
 * ALWAYS returns the same shape used by the old working scanner:
 * {
 *   found: true,
 *   product_id,
 *   product_name,
 *   store_id,
 *   store_name
 * }
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

      // Try to find a store via product_store, else Tesco fallback.
      const storeJoin = await pool.query(
        `
        SELECT s.id AS store_id, s.name AS store_name
        FROM product_store ps
        JOIN stores s ON s.id = ps.store_id
        WHERE ps.product_id = $1
        ORDER BY s.id
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

      const tescoId = await getTescoStoreId();
      return res.json({
        found: true,
        product_id: product.id,
        product_name: product.name,
        store_id: tescoId,
        store_name: "Tesco",
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

    const tescoId = await getTescoStoreId();

    // New behaviour: let the client classify the product before creating it in DB
    return res.json({
      found: true,
      product_id: null,
      product_name: name,
      store_id: tescoId,
      store_name: "Tesco",
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
 * Returns: { product_id, product_name, store_id, store_name }
 */
app.post("/products/create", async (req, res) => {
  const { name, barcode, foodTypeId, storeId } = req.body;

  if (!name || !barcode || !foodTypeId || !storeId) {
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

    // Prevent duplicates if two users classify the same barcode at the same time
    const existing = await pool.query(
      `SELECT id, name FROM products WHERE barcode = $1 LIMIT 1`,
      [barcode]
    );
    if (existing.rows.length > 0) {
      const storeNameRes = await pool.query(
        `SELECT name FROM stores WHERE id = $1 LIMIT 1`,
        [storeId]
      );
      return res.json({
        product_id: existing.rows[0].id,
        product_name: existing.rows[0].name,
        store_id: storeId,
        store_name: storeNameRes.rows[0]?.name ?? "Unknown",
      });
    }

    const insertProduct = await pool.query(
      `INSERT INTO products (name, barcode, food_type)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [name, barcode, foodTypeId]
    );

    const newProductId = insertProduct.rows[0].id;

    // Attach store relationship (keeps your existing design)
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

    const storeNameRes = await pool.query(
      `SELECT name FROM stores WHERE id = $1 LIMIT 1`,
      [storeId]
    );

    return res.json({
      product_id: newProductId,
      product_name: name,
      store_id: storeId,
      store_name: storeNameRes.rows[0]?.name ?? "Unknown",
    });
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ message: "Server error creating product" });
  }
});

/**
 * POST: Add product to user inventory
 * - default expiry_period_days=0, notified=false
 * - returns user_product_id AND days_left AND effective_period_days
 */
app.post("/user/addProduct", async (req, res) => {
  const { userId, productId, storeId, expiryDate } = req.body;

  if (!userId || !productId || !storeId || !expiryDate) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Insert row (expiry_period_days defaults to 0 meaning "use user default")
    const inserted = await pool.query(
      `
      INSERT INTO user_products (user_id, product_id, store_id, expiry_date, expiry_period_days, notified)
      VALUES ($1, $2, $3, $4, 0, false)
      RETURNING id, expiry_period_days, expiry_date
      `,
      [userId, productId, storeId, expiryDate]
    );

    const upRow = inserted.rows[0];

    // Get user's notification preference
    const userPrefRes = await pool.query(
      `SELECT notification_period_preference FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    const userPref = userPrefRes.rows.length
      ? Number(userPrefRes.rows[0].notification_period_preference ?? 0)
      : 0;

    const daysLeftRes = await pool.query(
      `SELECT ($1::date - CURRENT_DATE) AS days_left`,
      [upRow.expiry_date]
    );

    const days_left = Number(daysLeftRes.rows[0].days_left);

    const expiry_period_days = Number(upRow.expiry_period_days ?? 0);

    // Override rule:
    // - if expiry_period_days > 0 -> use it
    // - else -> use user default
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
 * Effective period:
 * - if up.expiry_period_days > 0 -> use up.expiry_period_days
 * - else -> use u.notification_period_preference
 *
 * Only returns rows where:
 * - up.notified = false
 * - days_left <= effective_period_days
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
 */
app.get("/user/:userId/foodtype/:foodTypeId", async (req, res) => {
  const { userId, foodTypeId } = req.params;

  try {
    const q = `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        s.name AS store_name,
        COUNT(up.id) AS quantity,
        MIN(up.expiry_date) AS nearest_expiry
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      JOIN stores s ON s.id = up.store_id
      WHERE up.user_id = $1 AND p.food_type = $2
      GROUP BY p.id, p.name, s.name
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
