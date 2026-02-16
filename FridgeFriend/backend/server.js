import dotenv from "dotenv";
dotenv.config(); 

console.log("ENV loaded:", {
  hasDb: Boolean(process.env.DATABASE_URL),
  hasSpoon: Boolean(process.env.SPOONACULAR_API_KEY),
});


import cors from "cors";
import express from "express";
import fetch from "node-fetch";
import pool from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

/**
 * -------------------------
 * CONFIG
 * -------------------------
 */
const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;
const SPOON_BASE = "https://api.spoonacular.com";

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
    return await getTescoStoreId();
  }
}

/**
 * -------------------------------
 * CHATBOT HELPERS (NO HARD-CODING)
 * -------------------------------
 */

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toBaseWord(word) {
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("es") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  return word;
}

function tokenize(str) {
  return normalizeText(str)
    .split(" ")
    .map(toBaseWord)
    .filter((t) => t && t.length > 2);
}

function ingredientMatchesInventory(ingredient, inventoryItems) {
  const ingTokens = tokenize(ingredient);
  if (!ingTokens.length) return false;

  for (const inv of inventoryItems) {
    const invTokens = tokenize(inv);
    if (!invTokens.length) continue;

    // any overlap token counts as match
    for (const t of ingTokens) {
      if (invTokens.includes(t)) return true;
    }
  }
  return false;
}

/**
 * Dish extraction:
 * - handles "I want to make an apple pie"
 * - strips fluff + leading articles
 */
function extractRequestedDish(message) {
  const raw = String(message || "").trim();
  const lower = normalizeText(raw);

  const patterns = [
    /^i want to make (.+)$/i,
    /^i want (.+)$/i,
    /^make (.+)$/i,
    /^cook (.+)$/i,
    /^recipe for (.+)$/i,
    /^how do i make (.+)$/i,
    /^how to make (.+)$/i,
  ];

  const cleanup = (s) => {
    let out = normalizeText(s)
      .replace(/\b(please|tonight|today)\b/g, "")
      .trim();
    out = out.replace(/^(a|an|the)\s+/i, "").trim();
    return out || null;
  };

  for (const p of patterns) {
    const match = raw.match(p);
    if (match && match[1]) return cleanup(match[1]);
  }

  if (lower.split(" ").length <= 6 && lower.length >= 3) {
    return cleanup(lower);
  }

  return null;
}

/**
 * Inventory summary for matching
 */
async function getUserInventorySummary(userId) {
  const r = await pool.query(
    `
    SELECT
      p.name,
      COUNT(*)::int AS qty,
      MIN(up.expiry_date) AS soonest_expiry
    FROM user_products up
    JOIN products p ON p.id = up.product_id
    WHERE up.user_id = $1
    GROUP BY p.name
    ORDER BY MIN(up.expiry_date) NULLS LAST, COUNT(*) DESC, p.name ASC
    LIMIT 60;
    `,
    [userId]
  );

  const expiringSoon = r.rows
    .filter((row) => row.soonest_expiry)
    .slice(0, 10)
    .map((row) => String(row.name));

  const pantry = r.rows.slice(0, 40).map((row) => String(row.name));

  return { expiringSoon, pantry };
}

/**
 * -------------------------
 * SPOONACULAR HELPERS
 * -------------------------
 */

async function spoonFetchJson(path, paramsObj) {
  if (!SPOONACULAR_API_KEY) {
    throw new Error("Missing SPOONACULAR_API_KEY on server.");
  }

  const params = new URLSearchParams({
    apiKey: SPOONACULAR_API_KEY,
    ...Object.fromEntries(
      Object.entries(paramsObj || {}).map(([k, v]) => [k, String(v)])
    ),
  });

  const url = `${SPOON_BASE}${path}?${params.toString()}`;
  const resp = await fetch(url);

  // Spoonacular can return 402 if quota exceeded; pass through helpful info
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Spoonacular error ${resp.status}: ${text}`);
  }

  return await resp.json();
}

async function spoonSearchRecipeByDish(dish) {
  // complexSearch is the simplest “search by name”
  const data = await spoonFetchJson("/recipes/complexSearch", {
    query: dish,
    number: 1,
    addRecipeInformation: false,
  });

  const first = data?.results?.[0];
  return first ? { id: first.id, title: first.title } : null;
}

async function spoonGetRecipeInformation(recipeId) {
  // includes extendedIngredients, sourceUrl, etc.
  const info = await spoonFetchJson(`/recipes/${recipeId}/information`, {
    includeNutrition: false,
  });

  const ingredients =
    Array.isArray(info?.extendedIngredients) ? info.extendedIngredients : [];

  const ingredientNames = ingredients
    .map((ing) => ing?.nameClean || ing?.originalName || ing?.name || "")
    .map((s) => String(s).trim())
    .filter(Boolean);

  return {
    id: info?.id,
    title: info?.title || "Recipe",
    url: info?.sourceUrl || info?.spoonacularSourceUrl || null,
    ingredients: ingredientNames,
  };
}

/**
 * -------------------------
 * CHATBOT ROUTE (Spoonacular)
 * -------------------------
 * POST /chat/recipe
 * Body: { userId, message }
 * Response: { reply, recipes: [{title,url,used[],missing[]}] }
 */
app.post("/chat/recipe", async (req, res) => {
  try {
    const { userId, message } = req.body || {};
    if (!userId || !message || !String(message).trim()) {
      return res
        .status(400)
        .json({ reply: "Missing userId or message.", recipes: [] });
    }

    const dish = extractRequestedDish(message);
    if (!dish) {
      return res.json({
        reply:
          "Tell me a specific dish you want to make (e.g. “apple pie”), and I’ll compare the ingredients to your inventory.",
        recipes: [],
      });
    }

    const { expiringSoon, pantry } = await getUserInventorySummary(userId);
    const inventoryItems = [...expiringSoon, ...pantry];

    if (inventoryItems.length === 0) {
      return res.json({
        reply:
          "Your inventory looks empty. Add a few items first, then I can compare ingredients against what you have.",
        recipes: [],
      });
    }

    const hit = await spoonSearchRecipeByDish(dish);

    if (!hit) {
      return res.json({
        reply: `I couldn't find a Spoonacular recipe for "${dish}". Try a slightly different wording (e.g. “apple tart”).`,
        recipes: [],
      });
    }

    const recipe = await spoonGetRecipeInformation(hit.id);

    const used = recipe.ingredients.filter((i) =>
      ingredientMatchesInventory(i, inventoryItems)
    );
    const missing = recipe.ingredients.filter(
      (i) => !ingredientMatchesInventory(i, inventoryItems)
    );

    const reply =
      `For "${recipe.title}", here’s what you have vs what you need:` +
      ` ✅ You have: ${used.length ? used.slice(0, 10).join(", ") : "—"}.` +
      ` 🛒 You need: ${missing.length ? missing.slice(0, 10).join(", ") : "—"}.`;

    return res.json({
      reply,
      recipes: [
        {
          title: recipe.title,
          url: recipe.url,
          used: used.slice(0, 20),
          missing: missing.slice(0, 20),
        },
      ],
    });
  } catch (err) {
    console.error("Chat recipe error:", err);
    return res.status(500).json({
      reply:
        "Sorry — I couldn’t fetch recipe suggestions right now. Check your Spoonacular key/quota and server logs.",
      recipes: [],
    });
  }
});

/**
 * -------------------------
 * The rest of your existing routes
 * -------------------------
 * (Left unchanged from your current version)
 */

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
 * POST: Create a new store
 */
app.post("/stores", async (req, res) => {
  const { name } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Missing store name" });
  }

  const cleaned = String(name).trim();

  try {
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
 */
app.post("/scan", async (req, res) => {
  const { barcode } = req.body;
  if (!barcode) {
    return res.status(400).json({ found: false, message: "Missing barcode" });
  }

  try {
    const localProduct = await pool.query(
      `SELECT id, name FROM products WHERE barcode = $1 LIMIT 1`,
      [barcode]
    );

    if (localProduct.rows.length > 0) {
      const product = localProduct.rows[0];

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

    const offRes = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
    const offData = await offRes.json();

    if (!offData || offData.status === 0) return res.json({ found: false });

    const name =
      offData.product?.product_name ||
      offData.product?.generic_name ||
      "Unnamed Product";

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
 * POST: Create product
 */
app.post("/products/create", async (req, res) => {
  const { name, barcode, foodTypeId, storeId } = req.body;

  if (!name || !foodTypeId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const ft = await pool.query(`SELECT id FROM food_types WHERE id = $1 LIMIT 1`, [
      foodTypeId,
    ]);
    if (ft.rows.length === 0) {
      return res.status(400).json({ message: "Invalid food type" });
    }

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
 */
app.post("/user/addProduct", async (req, res) => {
  const { userId, productId, storeId, expiryDate } = req.body;

  if (!userId || !productId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const effectiveStoreId = storeId ? Number(storeId) : await getNoStoreId();

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
    const effective_period_days = expiry_period_days > 0 ? expiry_period_days : userPref;

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
 * POST: Mark notified
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
 * GET: Settings
 */
app.get("/user/:userId/settings", async (req, res) => {
  const { userId } = req.params;

  try {
    const r = await pool.query(
      `
      SELECT notification_period_preference
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      notification_period_preference: Number(
        r.rows[0].notification_period_preference ?? 0
      ),
    });
  } catch (err) {
    console.error("Get settings error:", err);
    res.status(500).json({ message: "Server error loading settings" });
  }
});

/**
 * POST: Update notification preference + sweep
 */
app.post("/user/:userId/settings/notificationPeriod", async (req, res) => {
  const { userId } = req.params;
  const { notification_period_preference, overrideExisting } = req.body;

  const pref = Number(notification_period_preference);
  if (!Number.isFinite(pref) || pref < 0) {
    return res
      .status(400)
      .json({ message: "Invalid notification_period_preference" });
  }

  const override = Boolean(overrideExisting);

  try {
    await pool.query(
      `
      UPDATE users
      SET notification_period_preference = $1
      WHERE id = $2
      `,
      [pref, userId]
    );

    const r = await pool.query(
      `
      SELECT
        up.id AS user_product_id,
        p.name AS product_name,
        (up.expiry_date::date - CURRENT_DATE) AS days_left,
        CASE
          WHEN $2::boolean = true THEN u.notification_period_preference
          WHEN COALESCE(up.expiry_period_days, 0) > 0 THEN up.expiry_period_days
          ELSE u.notification_period_preference
        END AS effective_period_days
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      JOIN users u ON u.id = up.user_id
      WHERE up.user_id = $1
        AND up.notified = false
        AND up.expiry_date IS NOT NULL
        AND (up.expiry_date::date - CURRENT_DATE) <=
          CASE
            WHEN $2::boolean = true THEN u.notification_period_preference
            WHEN COALESCE(up.expiry_period_days, 0) > 0 THEN up.expiry_period_days
            ELSE u.notification_period_preference
          END
      ORDER BY up.id ASC
      LIMIT 200;
      `,
      [userId, override]
    );

    res.json({
      notification_period_preference: pref,
      overrideExisting: override,
      pending: r.rows.map((row) => ({
        user_product_id: Number(row.user_product_id),
        product_name: String(row.product_name),
        days_left: Number(row.days_left),
        effective_period_days: Number(row.effective_period_days),
      })),
    });
  } catch (err) {
    console.error("Update settings error:", err);
    res.status(500).json({ message: "Server error updating settings" });
  }
});

/**
 * GET: Pending notifications
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
        CASE
          WHEN COALESCE(up.expiry_period_days, 0) > 0 THEN up.expiry_period_days
          ELSE u.notification_period_preference
        END AS effective_period_days
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      JOIN users u ON u.id = up.user_id
      WHERE up.user_id = $1
        AND up.notified = false
        AND up.expiry_date IS NOT NULL
        AND (up.expiry_date::date - CURRENT_DATE) <=
          CASE
            WHEN COALESCE(up.expiry_period_days, 0) > 0 THEN up.expiry_period_days
            ELSE u.notification_period_preference
          END
      ORDER BY up.id ASC
      LIMIT 50;
      `,
      [userId]
    );

    res.json(
      r.rows.map((row) => ({
        ...row,
        days_left: Number(row.days_left),
        effective_period_days: Number(row.effective_period_days),
      }))
    );
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
