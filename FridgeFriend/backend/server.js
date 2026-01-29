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

async function getDefaultFoodTypeId() {
  // IMPORTANT: avoids FK errors if food_type 1 doesn't exist
  try {
    const r = await pool.query(`SELECT id FROM food_types ORDER BY id LIMIT 1`);
    if (r.rows.length > 0) return r.rows[0].id;
  } catch (e) {
    console.warn("getDefaultFoodTypeId error:", e?.message ?? e);
  }
  return 1; // last resort fallback (but ideally the query works)
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
 * If OFF finds it but it's not in DB, we create it locally and return ids.
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
      let store_id;
      let store_name;

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
        store_id = storeJoin.rows[0].store_id;
        store_name = storeJoin.rows[0].store_name;
      } else {
        store_id = await getTescoStoreId();
        store_name = "Tesco";
      }

      return res.json({
        found: true,
        product_id: product.id,
        product_name: product.name,
        store_id,
        store_name,
      });
    }

    // 2) OpenFoodFacts lookup
    const offRes = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
    const offData = await offRes.json();

    if (!offData || offData.status === 0) {
      return res.json({ found: false });
    }

    const product_name =
      offData.product?.product_name ||
      offData.product?.generic_name ||
      "Unnamed Product";

    // 3) Create product locally (IMPORTANT: ensure FK-safe food_type id)
    const foodTypeId = await getDefaultFoodTypeId();

    const insertProduct = await pool.query(
      `
      INSERT INTO products (name, barcode, food_type)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [product_name, barcode, foodTypeId]
    );

    const product_id = insertProduct.rows[0].id;

    // 4) Link to Tesco in product_store (if table exists / constraint matches)
    const tescoId = await getTescoStoreId();
    try {
      await pool.query(
        `
        INSERT INTO product_store (product_id, store_id, price)
        VALUES ($1, $2, $3)
        ON CONFLICT (product_id, store_id) DO NOTHING
        `,
        [product_id, tescoId, 0.0]
      );
    } catch (e) {
      // Don’t break scanning if you don’t have product_store or conflict key differs
      console.warn("product_store insert skipped:", e?.message ?? e);
    }

    // ✅ Return OLD SHAPE (what your scanner UI expects)
    return res.json({
      found: true,
      product_id,
      product_name,
      store_id: tescoId,
      store_name: "Tesco",
    });
  } catch (err) {
    console.error("Scan error:", err);
    return res
      .status(500)
      .json({ found: false, message: "Server error while scanning" });
  }
});

/**
 * POST: Add product to user inventory (notifications columns included)
 */
app.post("/user/addProduct", async (req, res) => {
  const { userId, productId, storeId, expiryDate } = req.body;

  if (!userId || !productId || !storeId || !expiryDate) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const inserted = await pool.query(
      `
      INSERT INTO user_products (user_id, product_id, store_id, expiry_date, expiry_period_days, notified)
      VALUES ($1, $2, $3, $4, 0, false)
      RETURNING id
      `,
      [userId, productId, storeId, expiryDate]
    );

    res.json({
      message: "Product added successfully",
      user_product_id: inserted.rows[0].id,
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
 * GET: Pending notifications (covers manual SQL inserts)
 */
app.get("/user/:userId/pendingNotifications", async (req, res) => {
  const { userId } = req.params;

  try {
    const r = await pool.query(
      `
      SELECT
        up.id AS user_product_id,
        p.name AS product_name
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      WHERE up.user_id = $1
        AND up.notified = false
      ORDER BY up.id ASC
      LIMIT 50
      `,
      [userId]
    );

    res.json(r.rows);
  } catch (err) {
    console.error("Pending notifications error:", err);
    res
      .status(500)
      .json({ message: "Server error loading pending notifications" });
  }
});

/**
 * GET: User products by food type (used by Home)
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
