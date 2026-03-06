import dotenv from "dotenv";
dotenv.config();

console.log("ENV loaded:", {
  hasDb: Boolean(process.env.DATABASE_URL),
  hasSpoon: Boolean(process.env.SPOONACULAR_API_KEY),
});

import bcrypt from "bcrypt";
import cors from "cors";
import express from "express";
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
const BCRYPT_ROUNDS = 12;

/**
 * -------------------------
 * Small error helper
 * -------------------------
 */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function parseOptionalUserId(raw) {
  if (raw === undefined || raw === null) return null;

  // If Express gives an array (can happen with repeated query params)
  if (Array.isArray(raw)) raw = raw[0];

  const s = String(raw).trim();
  if (!s) return null;

  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;

  return n;
}

function parseOptionalStoreId(raw) {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) raw = raw[0];

  const s = String(raw).trim();
  if (!s) return null;

  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new HttpError(400, "Invalid storeId");
  }
  return n;
}

function cleanListName(name) {
  const s = String(name || "").trim();
  if (!s) return null;
  if (s.length > 80) return s.slice(0, 80);
  return s;
}

function cleanCustomItemName(name) {
  const s = String(name || "").trim();
  if (!s) return null;
  if (s.length > 80) return s.slice(0, 80);
  return s;
}

function toPositiveInt(v, fallback = null) {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

async function assertUserOwnsList(userId, listId) {
  const r = await pool.query(
    `SELECT id, user_id, name, created_at, updated_at FROM shopping_lists WHERE id = $1 LIMIT 1`,
    [listId],
  );
  const row = r.rows[0] || null;
  if (!row) throw new HttpError(404, "Shopping list not found");
  if (Number(row.user_id) !== Number(userId))
    throw new HttpError(403, "Not your shopping list");
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
  if (row.is_system)
    throw new HttpError(403, "System stores cannot be deleted");
  if (Number(row.owner_user_id) !== Number(userId))
    throw new HttpError(403, "Not your store");

  return row;
}

/**
 * -------------------------
 * Store helpers
 * -------------------------
 */
async function getTescoStoreId() {
  try {
    const r = await pool.query(
      `SELECT id FROM stores WHERE LOWER(name) = 'tesco' AND is_system = true LIMIT 1`,
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

async function getLastRecordedPrice(userId, productId, storeId) {
  const r = await pool.query(
    `
    SELECT last_price
    FROM user_product_prices
    WHERE user_id = $1
      AND product_id = $2
      AND store_id IS NOT DISTINCT FROM $3
    LIMIT 1
    `,
    [userId, productId, storeId ?? null],
  );

  return r.rows.length ? r.rows[0].last_price : null;
}

/**
 * -------------------------------
 * TEXT / MATCH HELPERS
 * -------------------------------
 */
function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
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

    for (const t of ingTokens) {
      if (invTokens.includes(t)) return true;
    }
  }
  return false;
}

/**
 * Dish extraction
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
 * Inventory summary for chat matching
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
    [userId],
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
      Object.entries(paramsObj || {}).map(([k, v]) => [k, String(v)]),
    ),
  });

  const url = `${SPOON_BASE}${path}?${params.toString()}`;
  const resp = await fetch(url);

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Spoonacular error ${resp.status}: ${text}`);
  }

  return await resp.json();
}

async function spoonAutocompleteRecipe(dish) {
  const data = await spoonFetchJson("/recipes/autocomplete", {
    query: dish,
    number: 25,
  });
  return Array.isArray(data) ? data : [];
}

/**
 * Canonical title selection (no dish hardcoding)
 */
function scoreTitleForDish(dish, title) {
  const dishNorm = normalizeText(dish);
  const titleNorm = normalizeText(title);

  if (!dishNorm || !titleNorm) return -Infinity;
  if (titleNorm === dishNorm) return 1_000_000;

  const dishTokens = dishNorm.split(" ").filter(Boolean);
  const head = dishTokens[dishTokens.length - 1] || "";

  let score = 0;

  const idx = titleNorm.indexOf(dishNorm);
  const hasPhrase = idx >= 0;

  if (hasPhrase) score += 2000;
  if (hasPhrase && titleNorm.endsWith(dishNorm)) score += 1200;
  if (hasPhrase && titleNorm.startsWith(dishNorm)) score += 150;

  if (hasPhrase) {
    const afterStr = titleNorm.slice(idx + dishNorm.length).trim();
    const afterTokens = afterStr ? afterStr.split(" ").filter(Boolean) : [];

    const MODIFIERS = new Set([
      "recipe",
      "easy",
      "best",
      "simple",
      "quick",
      "homemade",
      "classic",
      "traditional",
      "authentic",
      "ultimate",
      "perfect",
      "healthy",
      "vegan",
      "vegetarian",
      "gluten",
      "free",
      "low",
      "carb",
      "keto",
      "spicy",
      "creamy",
      "baked",
      "roasted",
      "grilled",
      "one",
      "pot",
    ]);

    const nonModifierCount = afterTokens.filter(
      (t) => !MODIFIERS.has(t),
    ).length;

    score -= afterTokens.length * 250;
    score -= nonModifierCount * 450;
  }

  const titleTokens = titleNorm.split(" ").filter(Boolean);
  if (head && titleTokens[titleTokens.length - 1] === head) score += 600;

  const extraWords = Math.max(0, titleTokens.length - dishTokens.length);
  score -= extraWords * 40;

  score -= titleNorm.length;

  return score;
}

function pickBestRecipeHit(dish, hits) {
  if (!Array.isArray(hits) || hits.length === 0) return null;

  let best = null;
  let bestScore = -Infinity;

  for (const h of hits) {
    const t = h?.title || "";
    const s = scoreTitleForDish(dish, t);
    if (s > bestScore) {
      bestScore = s;
      best = h;
    }
  }
  return best;
}

function dedupeById(hits) {
  const seen = new Set();
  const out = [];
  for (const h of hits || []) {
    const id = h?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(h);
  }
  return out;
}

async function spoonSearchRecipeByDish(dish) {
  const suggestions = await spoonAutocompleteRecipe(dish);
  if (suggestions.length) {
    const bestAuto = pickBestRecipeHit(dish, suggestions);
    if (bestAuto) return { id: bestAuto.id, title: bestAuto.title };
  }

  const PAGE_SIZE = 50;
  const MAX_PAGES = 6;

  let collected = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;

    const data = await spoonFetchJson("/recipes/complexSearch", {
      query: dish,
      number: PAGE_SIZE,
      offset,
      instructionsRequired: true,
      addRecipeInformation: false,
      titleMatch: true,
      sort: "popularity",
      sortDirection: "desc",
    });

    const results = Array.isArray(data?.results) ? data.results : [];
    if (!results.length) break;

    collected = dedupeById(collected.concat(results));

    const dishNorm = normalizeText(dish);
    const exact = collected.find(
      (r) => normalizeText(r?.title || "") === dishNorm,
    );
    if (exact) return { id: exact.id, title: exact.title };
  }

  try {
    const data2 = await spoonFetchJson("/recipes/complexSearch", {
      query: dish,
      number: 50,
      offset: 0,
      instructionsRequired: true,
      addRecipeInformation: false,
      titleMatch: true,
      sort: "meta-score",
      sortDirection: "desc",
    });

    const results2 = Array.isArray(data2?.results) ? data2.results : [];
    if (results2.length) {
      collected = dedupeById(collected.concat(results2));
      const dishNorm = normalizeText(dish);
      const exact2 = collected.find(
        (r) => normalizeText(r?.title || "") === dishNorm,
      );
      if (exact2) return { id: exact2.id, title: exact2.title };
    }
  } catch (e) {
    console.warn("complexSearch meta-score fallback error:", e?.message ?? e);
  }

  const best = pickBestRecipeHit(dish, collected);
  return best ? { id: best.id, title: best.title } : null;
}

async function spoonGetRecipeInformation(recipeId) {
  const info = await spoonFetchJson(`/recipes/${recipeId}/information`, {
    includeNutrition: false,
  });

  const ingredients = Array.isArray(info?.extendedIngredients)
    ? info.extendedIngredients
    : [];

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
 * RECIPES HELPERS (DB)
 * -------------------------
 */

/** clean ingredient strings (enforces min 3 chars + unique) */
function cleanIngredientStrings(value) {
  const arr = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();

  for (const v of arr) {
    const raw = typeof v === "string" ? v : String(v?.name || "");
    const name = raw.trim();
    if (!name) continue;
    if (name.length < 3) continue; // keep your new rule

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }

  return out;
}

/** ensure user saved recipe */
async function assertUserSavedRecipe(userId, recipeId) {
  const r = await pool.query(
    `SELECT 1 FROM user_saved_recipes WHERE user_id = $1 AND recipe_id = $2 LIMIT 1`,
    [userId, recipeId],
  );
  if (!r.rows.length) throw new HttpError(403, "Not saved by this user");
}

/**get recipe meta for auth decisions */
async function getRecipeMeta(recipeId) {
  const r = await pool.query(
    `SELECT id, source, created_by_user_id FROM recipes WHERE id = $1 LIMIT 1`,
    [recipeId],
  );
  return r.rows[0] || null;
}

async function getUserInventoryItems(userId) {
  const r = await pool.query(
    `
    SELECT p.name
    FROM user_products up
    JOIN products p ON p.id = up.product_id
    WHERE up.user_id = $1
    GROUP BY p.name
    ORDER BY p.name ASC
    `,
    [userId],
  );
  return r.rows.map((row) => String(row.name));
}

function normalizeIngredientsJsonbInput(value) {
  if (value === undefined || value === null) return null;

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) return value;

  return null;
}

function toIngredientObjects(ingredientsArray) {
  const arr = Array.isArray(ingredientsArray) ? ingredientsArray : [];
  const out = [];

  let i = 0;
  for (const v of arr) {
    const name = String(v ?? "").trim();
    if (!name) continue;
    i++;
    out.push({
      id: i,
      recipe_id: null,
      name,
      amount: null,
      unit: null,
      position: i,
    });
  }

  return out;
}

async function getRecipeWithIngredients(recipeId) {
  const r = await pool.query(
    `
    SELECT id, title, source, external_id, source_url, created_by_user_id, igredients_json
    FROM recipes
    WHERE id = $1
    LIMIT 1
    `,
    [recipeId],
  );
  if (!r.rows.length) return null;

  const row = r.rows[0];

  const ingredientsArr = normalizeIngredientsJsonbInput(row.igredients_json);
  const ingredients = toIngredientObjects(ingredientsArr);

  return { ...row, ingredients };
}

/*
 * If a saved Spoonacular recipe has 0 ingredients in DB, fetch once and store ingredient names.
 */
async function ensureRecipeIngredientsInDb(recipeRow) {
  if (!recipeRow) return;
  if (recipeRow.source !== "spoonacular") return;
  if (!recipeRow.external_id) return;

  const currentCount = Array.isArray(recipeRow.ingredients)
    ? recipeRow.ingredients.length
    : 0;
  if (currentCount > 0) return;

  const info = await spoonGetRecipeInformation(Number(recipeRow.external_id));
  const ingList = Array.isArray(info?.ingredients) ? info.ingredients : [];
  if (!ingList.length) return;

  const safeIngredients = cleanIngredientStrings(ingList);
  if (!safeIngredients.length) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const check = await client.query(
      `SELECT igredients_json, source_url FROM recipes WHERE id = $1 LIMIT 1`,
      [recipeRow.id],
    );
    const existing = check.rows[0] || null;

    const existingArr = normalizeIngredientsJsonbInput(
      existing?.igredients_json,
    );
    const existingCount = Array.isArray(existingArr) ? existingArr.length : 0;

    if (existingCount === 0) {
      await client.query(
        `UPDATE recipes SET igredients_json = $1 WHERE id = $2`,
        [JSON.stringify(safeIngredients), recipeRow.id],
      );
    }

    if (!existing?.source_url && info.url) {
      await client.query(`UPDATE recipes SET source_url = $1 WHERE id = $2`, [
        String(info.url),
        recipeRow.id,
      ]);
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function computeMissingForRecipe(userId, recipeId) {
  let recipe = await getRecipeWithIngredients(recipeId);
  if (!recipe) return null;

  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    await ensureRecipeIngredientsInDb(recipe);
    recipe = await getRecipeWithIngredients(recipeId);
    if (!recipe) return null;
  }

  const inventoryNames = await getUserInventoryItems(userId);

  const have = [];
  const missing = [];

  for (const ing of recipe.ingredients || []) {
    const name = String(ing.name || "").trim();
    if (!name) continue;

    if (ingredientMatchesInventory(name, inventoryNames)) have.push(name);
    else missing.push(name);
  }

  return {
    recipe: {
      id: Number(recipe.id),
      title: String(recipe.title),
      url: recipe.source_url || null,
      source: String(recipe.source),
      external_id: recipe.external_id || null,
    },
    have,
    missing,
  };
}

/*
 * Shared helper: upsert/insert recipe + insert ingredients (name only) + save to user
 */
function normalizeJsonbInput(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }
  if (typeof value === "object") return value;
  return null;
}

async function upsertAndSaveRecipeForUser({
  userId,
  title,
  source,
  externalId,
  url,
  ingredientsRaw,
  nutritionJson,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const normalizedNutrition = normalizeJsonbInput(nutritionJson);

    let recipeId = null;

    const safeIngredients = cleanIngredientStrings(ingredientsRaw);
    const ingredientsJson = safeIngredients.length ? safeIngredients : null;

    if (externalId) {
      const up = await client.query(
        `
        INSERT INTO recipes (title, source, external_id, source_url, created_by_user_id, nutrition_json, igredients_json)
        VALUES ($1, $2, $3, $4, NULL, $5, $6)
        ON CONFLICT (source, external_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          source_url = COALESCE(EXCLUDED.source_url, recipes.source_url),
          nutrition_json = COALESCE(EXCLUDED.nutrition_json, recipes.nutrition_json),
          igredients_json = COALESCE(EXCLUDED.igredients_json, recipes.igredients_json)
        RETURNING id
        `,
        [
          title,
          source,
          externalId,
          url,
          normalizedNutrition,
          ingredientsJson ? JSON.stringify(ingredientsJson) : null,
        ],
      );

      recipeId = Number(up.rows[0].id);
    } else {
      const ins = await client.query(
        `
        INSERT INTO recipes (title, source, external_id, source_url, created_by_user_id, nutrition_json, igredients_json)
        VALUES ($1, 'custom', NULL, $2, $3, $4, $5)
        RETURNING id
        `,
        [
          title,
          url,
          userId,
          normalizedNutrition,
          ingredientsJson ? JSON.stringify(ingredientsJson) : null,
        ],
      );

      recipeId = Number(ins.rows[0].id);
    }

    await client.query(
      `
      INSERT INTO user_saved_recipes (user_id, recipe_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, recipe_id) DO NOTHING
      `,
      [userId, recipeId],
    );

    await client.query("COMMIT");
    return recipeId;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * -------------------------
 * RECIPES ROUTES
 * -------------------------
 */

/**
 * Optional product search (UI autocomplete)
 * GET /products/search?q=milk
 */
app.get("/products/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const userId = parseOptionalUserId(req.query.userId);

  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;

  const limit = Math.min(Math.max(Number(limitRaw ?? 25), 1), 50);
  const offset = Math.max(Number(offsetRaw ?? 0), 0);

  if (!q && !userId) return res.json([]);

  try {
    if (userId) {
      if (!q) {
        const r = await pool.query(
          `
          SELECT id, name, food_type, is_system, owner_user_id
          FROM products
          WHERE (is_system = true OR owner_user_id = $1)
          ORDER BY id DESC
          LIMIT $2 OFFSET $3
          `,
          [userId, limit, offset],
        );
        return res.json(
          r.rows.map((row) => ({
            id: Number(row.id),
            name: String(row.name),
            food_type: row.food_type != null ? Number(row.food_type) : null,
            is_system: Boolean(row.is_system),
            owner_user_id: row.owner_user_id ?? null,
          })),
        );
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
        [userId, `%${q}%`, limit, offset],
      );
      return res.json(
        r.rows.map((row) => ({
          id: Number(row.id),
          name: String(row.name),
          food_type: row.food_type != null ? Number(row.food_type) : null,
          is_system: Boolean(row.is_system),
          owner_user_id: row.owner_user_id ?? null,
        })),
      );
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
      [`%${q}%`, limit, offset],
    );

    res.json(
      r.rows.map((row) => ({ id: Number(row.id), name: String(row.name) })),
    );
  } catch (e) {
    console.error("Product search error:", e);
    res.status(500).json({ message: "Server error searching products" });
  }
});

/**
 * Save recipe (from chatbot)
 * POST /user/:userId/recipes/save
 */
app.post("/user/:userId/recipes/save", async (req, res) => {
  const userId = Number(req.params.userId);
  const { recipe } = req.body || {};

  if (!userId || !recipe?.title) {
    return res.status(400).json({ message: "Missing userId or recipe.title" });
  }

  try {
    const recipeId = await upsertAndSaveRecipeForUser({
      userId,
      title: String(recipe.title).trim(),
      source: String(recipe.source || "custom"),
      externalId:
        recipe.external_id != null ? String(recipe.external_id) : null,
      url: recipe.url ? String(recipe.url) : null,
      ingredientsRaw: Array.isArray(recipe.ingredients)
        ? recipe.ingredients
        : [],
      nutritionJson: recipe.nutrition ?? null,
    });

    res.json({ saved: true, recipe_id: recipeId });
  } catch (e) {
    console.error("Save recipe error:", e);
    res.status(500).json({ message: "Server error saving recipe" });
  }
});

/**
 * Create custom recipe + save it
 * POST /user/:userId/recipes
 * Body: { title, url?, ingredients: string[] }
 */
app.post("/user/:userId/recipes", async (req, res) => {
  const userId = Number(req.params.userId);
  const { title, url, ingredients } = req.body || {};

  if (!userId || !title || !String(title).trim()) {
    return res.status(400).json({ message: "Missing title" });
  }

  const ing = cleanIngredientStrings(ingredients);
  if (!ing.length) {
    return res
      .status(400)
      .json({ message: "Add at least one ingredient (min 3 chars)" });
  }

  try {
    const recipeId = await upsertAndSaveRecipeForUser({
      userId,
      title: String(title).trim(),
      source: "custom",
      externalId: null,
      url: url ? String(url) : null,
      ingredientsRaw: ing,
      nutritionJson: null,
    });

    res.json({ created: true, recipe_id: recipeId });
  } catch (e) {
    console.error("Create recipe error:", e);
    res.status(500).json({ message: "Server error creating recipe" });
  }
});

/**
 * List user saved recipes
 * GET /user/:userId/recipes
 */
app.get("/user/:userId/recipes", async (req, res) => {
  const userId = Number(req.params.userId);

  try {
    const r = await pool.query(
      `
      SELECT r.id, r.title, r.source, r.external_id, r.source_url, u.saved_at
      FROM user_saved_recipes u
      JOIN recipes r ON r.id = u.recipe_id
      WHERE u.user_id = $1
      ORDER BY u.saved_at DESC
      LIMIT 200
      `,
      [userId],
    );

    res.json(
      r.rows.map((row) => ({
        id: Number(row.id),
        title: String(row.title),
        source: String(row.source),
        external_id: row.external_id ?? null,
        url: row.source_url ?? null,
        saved_at: row.saved_at,
      })),
    );
  } catch (e) {
    console.error("List recipes error:", e);
    res.status(500).json({ message: "Server error loading recipes" });
  }
});

/**
 * Get nutrition for a saved recipe
 * GET /user/:userId/recipes/:recipeId/nutrition
 *
 * If recipe is spoonacular -> fetch nutrition from Spoonacular using external_id
 * If recipe is custom -> return a friendly message (no nutrition available)
 */
app.get("/user/:userId/recipes/:recipeId/nutrition", async (req, res) => {
  const userId = Number(req.params.userId);
  const recipeId = Number(req.params.recipeId);

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(recipeId) ||
    recipeId <= 0
  ) {
    return res.status(400).json({ message: "Invalid userId or recipeId" });
  }

  try {
    await assertUserSavedRecipe(userId, recipeId);

    const meta = await pool.query(
      `SELECT id, source, external_id, title, nutrition_json
       FROM recipes
       WHERE id = $1
       LIMIT 1`,
      [recipeId],
    );
    if (!meta.rows.length) {
      return res.status(404).json({ message: "Recipe not found" });
    }

    const row = meta.rows[0];

    if (row.nutrition_json) {
      let servings = null;

      if (String(row.source) === "spoonacular" && row.external_id) {
        const externalIdNum = Number(row.external_id);
        if (Number.isFinite(externalIdNum)) {
          try {
            const info = await spoonFetchJson(
              `/recipes/${externalIdNum}/information`,
              {
                includeNutrition: false,
              },
            );
            servings = info?.servings ?? null;
          } catch (e) {
            console.warn(
              "Servings fetch (cached nutrition) failed:",
              e?.message ?? e,
            );
          }
        }
      }

      return res.json({
        recipe_id: Number(row.id),
        servings,
        nutrition: row.nutrition_json,
        nutrition_updated_at: null,
        cached: true,
      });
    }

    if (String(row.source) !== "spoonacular" || !row.external_id) {
      return res.json({
        recipe_id: Number(row.id),
        servings: null,
        nutrition: null,
        nutrition_updated_at: null,
        cached: true,
      });
    }

    const externalIdNum = Number(row.external_id);
    if (!Number.isFinite(externalIdNum)) {
      return res
        .status(400)
        .json({ message: "Invalid external_id for Spoonacular recipe" });
    }

    const widget = await spoonFetchJson(
      `/recipes/${externalIdNum}/nutritionWidget.json`,
      {},
    );

    const info = await spoonFetchJson(`/recipes/${externalIdNum}/information`, {
      includeNutrition: false,
    });

    const servings = info?.servings ?? null;

    await pool.query(`UPDATE recipes SET nutrition_json = $1 WHERE id = $2`, [
      widget,
      recipeId,
    ]);

    return res.json({
      recipe_id: Number(row.id),
      servings,
      nutrition: widget,
      nutrition_updated_at: null,
      cached: false,
    });
  } catch (e) {
    console.error("Nutrition error:", e);
    return res.status(e.status || 500).json({
      message: e.message || "Server error loading nutrition",
    });
  }
});

/**
 * Get recipe details (must be saved by user)
 * GET /user/:userId/recipes/:recipeId
 */
app.get("/user/:userId/recipes/:recipeId", async (req, res) => {
  const userId = Number(req.params.userId);
  const recipeId = Number(req.params.recipeId);

  try {
    await assertUserSavedRecipe(userId, recipeId);

    const recipe = await getRecipeWithIngredients(recipeId);
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });

    res.json({
      id: Number(recipe.id),
      title: String(recipe.title),
      source: String(recipe.source),
      external_id: recipe.external_id ?? null,
      url: recipe.source_url ?? null,
      ingredients: (recipe.ingredients || []).map((i) => ({
        id: Number(i.id),
        name: String(i.name),
        amount: i.amount != null ? Number(i.amount) : null,
        unit: i.unit ?? null,
      })),
    });
  } catch (e) {
    console.error("Recipe details error:", e);
    res
      .status(e.status || 500)
      .json({ message: e.message || "Server error loading recipe" });
  }
});

/**
 * Update custom recipe (only owner)
 * PUT /user/:userId/recipes/:recipeId
 */
app.put("/user/:userId/recipes/:recipeId", async (req, res) => {
  const userId = Number(req.params.userId);
  const recipeId = Number(req.params.recipeId);

  const { title, url, ingredients } = req.body || {};
  const newTitle = String(title || "").trim();
  const newUrl = url ? String(url).trim() : null;
  const newIngredients = cleanIngredientStrings(ingredients);

  if (!userId || !recipeId) {
    return res.status(400).json({ message: "Invalid userId or recipeId" });
  }
  if (!newTitle) {
    return res.status(400).json({ message: "Missing title" });
  }
  if (!newIngredients.length) {
    return res
      .status(400)
      .json({ message: "Add at least one ingredient (min 3 chars)" });
  }

  try {
    await assertUserSavedRecipe(userId, recipeId);

    const meta = await getRecipeMeta(recipeId);
    if (!meta) return res.status(404).json({ message: "Recipe not found" });

    if (
      meta.source !== "custom" ||
      Number(meta.created_by_user_id) !== userId
    ) {
      return res.status(403).json({
        message: "Only custom recipes you created can be edited.",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE recipes SET title = $1, source_url = $2, igredients_json = $3 WHERE id = $4`,
        [newTitle, newUrl, JSON.stringify(newIngredients), recipeId],
      );

      await client.query("COMMIT");
      res.json({ updated: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("Update recipe error:", e);
    res
      .status(e.status || 500)
      .json({ message: e.message || "Server error updating recipe" });
  }
});

/**
 * Remove from saved list; delete custom recipe row only if owner AND nobody else saved it
 * DELETE /user/:userId/recipes/:recipeId
 */
app.delete("/user/:userId/recipes/:recipeId", async (req, res) => {
  const userId = Number(req.params.userId);
  const recipeId = Number(req.params.recipeId);

  if (!userId || !recipeId) {
    return res.status(400).json({ message: "Invalid userId or recipeId" });
  }

  try {
    const delSaved = await pool.query(
      `DELETE FROM user_saved_recipes WHERE user_id = $1 AND recipe_id = $2`,
      [userId, recipeId],
    );

    if (delSaved.rowCount === 0) {
      return res.status(404).json({ message: "Recipe was not saved" });
    }

    const meta = await getRecipeMeta(recipeId);
    if (!meta) return res.json({ removed: true, deleted_recipe: false });

    if (
      meta.source === "custom" &&
      Number(meta.created_by_user_id) === userId
    ) {
      const c = await pool.query(
        `SELECT COUNT(*)::int AS n FROM user_saved_recipes WHERE recipe_id = $1`,
        [recipeId],
      );
      const n = Number(c.rows[0]?.n ?? 0);

      if (n === 0) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(`DELETE FROM recipes WHERE id = $1`, [recipeId]);
          await client.query("COMMIT");
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }

        return res.json({ removed: true, deleted_recipe: true });
      }
    }

    res.json({ removed: true, deleted_recipe: false });
  } catch (e) {
    console.error("Delete recipe error:", e);
    res.status(500).json({ message: "Server error deleting recipe" });
  }
});

/**
 * Missing items for a saved recipe (DB-first; Spoonacular only for one-time backfill)
 * GET /user/:userId/recipes/:recipeId/missing
 */
app.get("/user/:userId/recipes/:recipeId/missing", async (req, res) => {
  const userId = Number(req.params.userId);
  const recipeId = Number(req.params.recipeId);

  try {
    await assertUserSavedRecipe(userId, recipeId);

    const out = await computeMissingForRecipe(userId, recipeId);
    if (!out) return res.status(404).json({ message: "Recipe not found" });

    res.json(out);
  } catch (e) {
    console.error("Recipe missing error:", e);
    res
      .status(e.status || 500)
      .json({ message: e.message || "Server error computing missing" });
  }
});

/**
 * -------------------------
 * CHATBOT ROUTE (Spoonacular)
 * -------------------------
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

    let nutritionWidget = null;
    try {
      nutritionWidget = await spoonFetchJson(
        `/recipes/${hit.id}/nutritionWidget.json`,
        {},
      );
    } catch (e) {
      nutritionWidget = null;
    }

    const parseNum = (v) => {
      const s = String(v ?? "");
      const m = s.match(/(\d+(\.\d+)?)/);
      return m ? Number(m[1]) : null;
    };

    const nutritionSummary = nutritionWidget
      ? {
          calories: parseNum(nutritionWidget?.calories),
          protein_g: parseNum(nutritionWidget?.protein),
          carbs_g: parseNum(nutritionWidget?.carbs),
          fat_g: parseNum(nutritionWidget?.fat),
        }
      : null;

    const used = recipe.ingredients.filter((i) =>
      ingredientMatchesInventory(i, inventoryItems),
    );
    const missing = recipe.ingredients.filter(
      (i) => !ingredientMatchesInventory(i, inventoryItems),
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
          source: "spoonacular",
          external_id: String(recipe.id),
          ingredients: recipe.ingredients,
          used: used.slice(0, 20),
          missing: missing.slice(0, 20),
          servings: null,
          nutritionSummary,
          nutrition: nutritionWidget,
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
 * EXISTING ROUTES (unchanged from your original)
 * -------------------------
 */

/**
 * GET: Categories
 */
app.get("/categories", async (req, res) => {
  const userId = parseOptionalUserId(req.query.userId);

  try {
    if (userId) {
      const result = await pool.query(
        `
        SELECT id, name, is_system, owner_user_id
        FROM categories
        WHERE is_system = true OR owner_user_id = $1
        ORDER BY is_system DESC, id ASC
        `,
        [userId],
      );
      return res.json(result.rows);
    }

    const result = await pool.query(
      `
      SELECT id, name, is_system, owner_user_id
      FROM categories
      WHERE is_system = true
      ORDER BY id ASC
      `,
    );
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
  const categoryId = Number(req.params.id);
  const userId = parseOptionalUserId(req.query.userId);

  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return res.status(400).json({ message: "Invalid category id" });
  }

  try {
    // Ensure category is visible
    if (userId) {
      const cat = await pool.query(
        `
        SELECT id
        FROM categories
        WHERE id = $1 AND (is_system = true OR owner_user_id = $2)
        LIMIT 1
        `,
        [categoryId, userId],
      );
      if (!cat.rows.length) return res.json([]);
    } else {
      const cat = await pool.query(
        `
        SELECT id
        FROM categories
        WHERE id = $1 AND is_system = true
        LIMIT 1
        `,
        [categoryId],
      );
      if (!cat.rows.length) return res.json([]);
    }

    if (userId) {
      const result = await pool.query(
        `
        SELECT id, category, name, is_system, owner_user_id
        FROM food_types
        WHERE category = $1
          AND (is_system = true OR owner_user_id = $2)
        ORDER BY is_system DESC, id ASC
        `,
        [categoryId, userId],
      );
      return res.json(result.rows);
    }

    const result = await pool.query(
      `
      SELECT id, category, name, is_system, owner_user_id
      FROM food_types
      WHERE category = $1 AND is_system = true
      ORDER BY id ASC
      `,
      [categoryId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Food types error:", err);
    res.status(500).json({ message: "Server error loading food types" });
  }
});

/**
 * --------------------------------------------
 * USER-CREATED CATEGORIES + FOOD TYPES (CRUD)
 * --------------------------------------------
 * - Only creates/deletes NON-system rows (is_system = false)
 * - Enforces ownership via owner_user_id
 * - Prevents deletion if referenced by products (avoid cascade deletes)
 */

/**
 * POST: Create a user category
 * POST /user/:userId/categories
 * Body: { name: string }
 */
app.post("/user/:userId/categories", async (req, res) => {
  const userId = Number(req.params.userId);
  const name = String(req.body?.name || "").trim();

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid userId" });
  }
  if (!name) return res.status(400).json({ message: "Missing category name" });
  if (name.length > 20) {
    return res
      .status(400)
      .json({ message: "Category name must be <= 20 characters" });
  }

  try {
    // Optional: verify user exists
    const u = await pool.query(`SELECT 1 FROM users WHERE id = $1 LIMIT 1`, [
      userId,
    ]);
    if (!u.rows.length)
      return res.status(404).json({ message: "User not found" });

    const inserted = await pool.query(
      `
      INSERT INTO categories (name, is_system, owner_user_id)
      VALUES ($1, false, $2)
      RETURNING id, name, is_system, owner_user_id
      `,
      [name, userId],
    );

    return res.status(201).json({
      category: {
        id: Number(inserted.rows[0].id),
        name: String(inserted.rows[0].name),
        is_system: Boolean(inserted.rows[0].is_system),
        owner_user_id: inserted.rows[0].owner_user_id ?? null,
      },
    });
  } catch (e) {
    if (e?.code === "23505") {
      return res
        .status(409)
        .json({ message: "You already have a category with that name" });
    }
    console.error("Create category error:", e);
    return res.status(500).json({ message: "Server error creating category" });
  }
});

/**
 * DELETE: Delete a user category (only if NOT used by any products)
 * DELETE /user/:userId/categories/:categoryId
 */
app.delete("/user/:userId/categories/:categoryId", async (req, res) => {
  const userId = Number(req.params.userId);
  const categoryId = Number(req.params.categoryId);

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(categoryId) ||
    categoryId <= 0
  ) {
    return res.status(400).json({ message: "Invalid userId or categoryId" });
  }

  try {
    const cat = await pool.query(
      `
      SELECT id
      FROM categories
      WHERE id = $1 AND is_system = false AND owner_user_id = $2
      LIMIT 1
      `,
      [categoryId, userId],
    );
    if (!cat.rows.length) {
      return res
        .status(404)
        .json({ message: "Category not found (or not owned by user)" });
    }

    const usage = await pool.query(
      `
      SELECT COUNT(*)::int AS n
      FROM products p
      JOIN food_types ft ON ft.id = p.food_type
      WHERE ft.category = $1
      `,
      [categoryId],
    );
    const n = Number(usage.rows[0]?.n ?? 0);
    if (n > 0) {
      return res.status(409).json({
        message:
          "Category is in use by products. Move/delete those products (or change their food type) before deleting this category.",
        products_using_category: n,
      });
    }

    await pool.query(
      `DELETE FROM categories WHERE id = $1 AND is_system = false AND owner_user_id = $2`,
      [categoryId, userId],
    );

    return res.json({ deleted: true });
  } catch (e) {
    console.error("Delete category error:", e);
    return res.status(500).json({ message: "Server error deleting category" });
  }
});

/**
 * POST: Create a user food type inside a category (system or user category)
 * POST /user/:userId/categories/:categoryId/food
 * Body: { name: string }
 */
app.post("/user/:userId/categories/:categoryId/food", async (req, res) => {
  const userId = Number(req.params.userId);
  const categoryId = Number(req.params.categoryId);
  const name = String(req.body?.name || "").trim();

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(categoryId) ||
    categoryId <= 0
  ) {
    return res.status(400).json({ message: "Invalid userId or categoryId" });
  }
  if (!name) return res.status(400).json({ message: "Missing food type name" });
  if (name.length > 20) {
    return res
      .status(400)
      .json({ message: "Food type name must be <= 20 characters" });
  }

  try {
    const cat = await pool.query(
      `
      SELECT id
      FROM categories
      WHERE id = $1 AND (is_system = true OR owner_user_id = $2)
      LIMIT 1
      `,
      [categoryId, userId],
    );
    if (!cat.rows.length)
      return res
        .status(404)
        .json({ message: "Category not found for this user" });

    const inserted = await pool.query(
      `
      INSERT INTO food_types (category, name, is_system, owner_user_id)
      VALUES ($1, $2, false, $3)
      RETURNING id, category, name, is_system, owner_user_id
      `,
      [categoryId, name, userId],
    );

    return res.status(201).json({
      food_type: {
        id: Number(inserted.rows[0].id),
        category: Number(inserted.rows[0].category),
        name: String(inserted.rows[0].name),
        is_system: Boolean(inserted.rows[0].is_system),
        owner_user_id: inserted.rows[0].owner_user_id ?? null,
      },
    });
  } catch (e) {
    if (e?.code === "23505") {
      return res.status(409).json({
        message: "You already have that food type name in this category",
      });
    }
    console.error("Create food type error:", e);
    return res.status(500).json({ message: "Server error creating food type" });
  }
});

/**
 * DELETE: Delete a user food type (only if NOT used by any products)
 * DELETE /user/:userId/foodtypes/:foodTypeId
 */
app.delete("/user/:userId/foodtypes/:foodTypeId", async (req, res) => {
  const userId = Number(req.params.userId);
  const foodTypeId = Number(req.params.foodTypeId);

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(foodTypeId) ||
    foodTypeId <= 0
  ) {
    return res.status(400).json({ message: "Invalid userId or foodTypeId" });
  }

  try {
    const ft = await pool.query(
      `
      SELECT id
      FROM food_types
      WHERE id = $1 AND is_system = false AND owner_user_id = $2
      LIMIT 1
      `,
      [foodTypeId, userId],
    );
    if (!ft.rows.length) {
      return res.status(404).json({
        message: "Food type not found (or not owned by user)",
      });
    }

    const usage = await pool.query(
      `SELECT COUNT(*)::int AS n FROM products WHERE food_type = $1`,
      [foodTypeId],
    );
    const n = Number(usage.rows[0]?.n ?? 0);
    if (n > 0) {
      return res.status(409).json({
        message:
          "Food type is in use by products. Change those products to a different food type before deleting this one.",
        products_using_food_type: n,
      });
    }

    await pool.query(
      `DELETE FROM food_types WHERE id = $1 AND is_system = false AND owner_user_id = $2`,
      [foodTypeId, userId],
    );

    return res.json({ deleted: true });
  } catch (e) {
    console.error("Delete food type error:", e);
    return res.status(500).json({ message: "Server error deleting food type" });
  }
});

/**
 * GET: Stores
 */
app.get("/stores", async (req, res) => {
  const userId = parseOptionalUserId(req.query.userId);

  try {
    if (userId) {
      const result = await pool.query(
        `
        SELECT id, name, is_system, owner_user_id
        FROM stores
        WHERE is_system = true OR owner_user_id = $1
        ORDER BY is_system DESC, name ASC
        `,
        [userId],
      );
      return res.json(result.rows);
    }

    const result = await pool.query(
      `
      SELECT id, name, is_system, owner_user_id
      FROM stores
      WHERE is_system = true
      ORDER BY name ASC
      `,
    );
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
  const { name, userId } = req.body;
  const uid = parseOptionalUserId(userId);

  if (!uid) {
    return res.status(400).json({ message: "Missing userId" });
  }

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Missing store name" });
  }

  const cleaned = String(name).trim();

  try {
    const existing = await pool.query(
      `
      SELECT id, name, is_system, owner_user_id
      FROM stores
      WHERE LOWER(name) = LOWER($1)
        AND (is_system = true OR owner_user_id = $2)
      LIMIT 1
      `,
      [cleaned, uid],
    );

    if (existing.rows.length > 0) {
      return res.json({
        store_id: existing.rows[0].id,
        store_name: existing.rows[0].name,
        reused: true,
      });
    }

    const inserted = await pool.query(
      `INSERT INTO stores (name, is_system, owner_user_id) VALUES ($1, false, $2) RETURNING id, name`,
      [cleaned, uid],
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

app.get("/user/:userId/shopping/candidates/inventory", async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid userId" });
  }

  try {
    const r = await pool.query(
      `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        COUNT(*)::int AS qty_in_inventory
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      WHERE up.user_id = $1
        AND (p.is_system = true OR p.owner_user_id = $1)
      GROUP BY p.id, p.name
      ORDER BY qty_in_inventory DESC, p.name ASC
      LIMIT 300
      `,
      [userId],
    );

    res.json(
      r.rows.map((row) => ({
        product_id: Number(row.product_id),
        product_name: String(row.product_name),
        qty_in_inventory: Number(row.qty_in_inventory),
      })),
    );
  } catch (e) {
    console.error("shopping candidates inventory error:", e);
    res
      .status(500)
      .json({ message: "Server error loading inventory candidates" });
  }
});

app.get("/user/:userId/shopping/candidates/history", async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid userId" });
  }

  try {
    const r = await pool.query(
      `
      SELECT DISTINCT ON (upp.product_id)
        upp.product_id,
        p.name AS product_name,
        upp.store_id,
        s.name AS store_name,
        upp.last_price,
        upp.updated_at
      FROM user_product_prices upp
      JOIN products p ON p.id = upp.product_id
      LEFT JOIN stores s ON s.id = upp.store_id
      WHERE upp.user_id = $1
        AND (p.is_system = true OR p.owner_user_id = $1)
        AND (
          upp.store_id IS NULL
          OR s.is_system = true
          OR s.owner_user_id = $1
        )
      ORDER BY upp.product_id, upp.updated_at DESC NULLS LAST, upp.id DESC
      LIMIT 400
      `,
      [userId],
    );

    res.json(
      r.rows.map((row) => ({
        product_id: Number(row.product_id),
        product_name: String(row.product_name),
        suggested_store_id: row.store_id ?? null,
        suggested_store_name: row.store_name ?? null,
        suggested_price: row.last_price ?? null,
      })),
    );
  } catch (e) {
    console.error("shopping candidates history error:", e);
    res
      .status(500)
      .json({ message: "Server error loading history candidates" });
  }
});

app.post("/user/:userId/shoppingLists", async (req, res) => {
  const userId = Number(req.params.userId);
  const name = cleanListName(req.body?.name);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid userId" });
  }
  if (!name) return res.status(400).json({ message: "Missing list name" });

  try {
    const ins = await pool.query(
      `
      INSERT INTO shopping_lists (user_id, name)
      VALUES ($1, $2)
      RETURNING id
      `,
      [userId, name],
    );
    res.status(201).json({ list_id: Number(ins.rows[0].id) });
  } catch (e) {
    console.error("create shopping list error:", e);
    res.status(500).json({ message: "Server error creating shopping list" });
  }
});

app.get("/user/:userId/shoppingLists", async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid userId" });
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
      [userId],
    );

    res.json(
      r.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    );
  } catch (e) {
    console.error("list shopping lists error:", e);
    res.status(500).json({ message: "Server error listing shopping lists" });
  }
});

app.delete("/user/:userId/shoppingLists/:listId", async (req, res) => {
  const userId = Number(req.params.userId);
  const listId = Number(req.params.listId);

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(listId) ||
    listId <= 0
  ) {
    return res.status(400).json({ message: "Invalid userId or listId" });
  }

  try {
    await assertUserOwnsList(userId, listId);

    await pool.query(
      `DELETE FROM shopping_lists WHERE id = $1 AND user_id = $2`,
      [listId, userId],
    );

    res.json({ deleted: true });
  } catch (e) {
    console.error("delete shopping list error:", e);
    res
      .status(e.status || 500)
      .json({ message: e.message || "Server error deleting shopping list" });
  }
});

app.post("/user/:userId/shoppingLists/:listId/items", async (req, res) => {
  const userId = Number(req.params.userId);
  const listId = Number(req.params.listId);

  const productId =
    req.body?.productId != null ? Number(req.body.productId) : null;
  const customName =
    req.body?.customName != null
      ? cleanCustomItemName(req.body.customName)
      : null;

  const storeIdRaw = req.body?.storeId;
  const storeId =
    storeIdRaw === undefined || storeIdRaw === null || String(storeIdRaw) === ""
      ? null
      : Number(storeIdRaw);

  const quantity = toPositiveInt(req.body?.quantity, 1) ?? 1;

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(listId) ||
    listId <= 0
  ) {
    return res.status(400).json({ message: "Invalid userId or listId" });
  }

  if (!productId && !customName) {
    return res.status(400).json({ message: "Provide productId or customName" });
  }
  if (productId && customName) {
    return res
      .status(400)
      .json({ message: "Provide either productId OR customName, not both" });
  }

  try {
    await assertUserOwnsList(userId, listId);
    await assertStoreVisibleToUser(userId, storeId);

    if (productId) {
      await assertProductVisibleToUser(userId, productId);
    }

    if (productId) {
      const upd = await pool.query(
        `
        UPDATE shopping_list_items
        SET quantity = quantity + $4
        WHERE list_id = $1
          AND product_id = $2
          AND custom_name IS NULL
          AND store_id IS NOT DISTINCT FROM $3
        RETURNING id
        `,
        [listId, productId, storeId, quantity],
      );

      if (upd.rows.length) {
        await pool.query(
          `UPDATE shopping_lists SET updated_at = now() WHERE id = $1`,
          [listId],
        );
        return res
          .status(200)
          .json({ item_id: Number(upd.rows[0].id), merged: true });
      }
    } else {
      const upd = await pool.query(
        `
        UPDATE shopping_list_items
        SET quantity = quantity + $4
        WHERE list_id = $1
          AND product_id IS NULL
          AND lower(custom_name) = lower($2)
          AND store_id IS NOT DISTINCT FROM $3
        RETURNING id
        `,
        [listId, customName, storeId, quantity],
      );

      if (upd.rows.length) {
        await pool.query(
          `UPDATE shopping_lists SET updated_at = now() WHERE id = $1`,
          [listId],
        );
        return res
          .status(200)
          .json({ item_id: Number(upd.rows[0].id), merged: true });
      }
    }

    // No existing row -> insert new
    const ins = await pool.query(
      `
      INSERT INTO shopping_list_items (list_id, product_id, custom_name, store_id, quantity)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [listId, productId, customName, storeId, quantity],
    );

    await pool.query(
      `UPDATE shopping_lists SET updated_at = now() WHERE id = $1`,
      [listId],
    );

    res.status(201).json({ item_id: Number(ins.rows[0].id), merged: false });
  } catch (e) {
    console.error("add shopping list item error:", e);
    res
      .status(e.status || 500)
      .json({ message: e.message || "Server error adding item" });
  }
});

app.post(
  "/user/:userId/shoppingLists/:listId/addToInventory",
  async (req, res) => {
    const userId = Number(req.params.userId);
    const listId = Number(req.params.listId);
    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];

    const cleanIds = itemIds
      .map((x) => Number(x))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !Number.isInteger(listId) ||
      listId <= 0
    ) {
      return res.status(400).json({ message: "Invalid userId or listId" });
    }

    if (!cleanIds.length) {
      return res.json({ added_inventory_rows: 0 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Load selected items (only those belonging to this list + user)
      const itemsRes = await client.query(
        `
      SELECT id, product_id, store_id, quantity
      FROM shopping_list_items
      WHERE list_id = $1
        AND id = ANY($2::int[])
        AND product_id IS NOT NULL
      `,
        [listId, cleanIds],
      );

      let added = 0;

      for (const row of itemsRes.rows) {
        const productId = Number(row.product_id);
        const storeId = row.store_id == null ? null : Number(row.store_id);
        const qty = Math.max(1, Number(row.quantity || 1));

        for (let i = 0; i < qty; i++) {
          // if your /user/addProduct already handles "No store" fallback, you could call that route instead.
          await client.query(
            `
          INSERT INTO user_products (user_id, product_id, store_id, expiry_date, expiry_period_days, notified)
          VALUES ($1, $2, $3, NULL, 0, false)
          `,
            [userId, productId, storeId],
          );
          added++;
        }
      }

      await client.query("COMMIT");
      return res.json({ added_inventory_rows: added });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("addToInventory error:", e);
      return res
        .status(500)
        .json({ message: "Server error adding to inventory" });
    } finally {
      client.release();
    }
  },
);

app.post(
  "/user/:userId/shoppingLists/:listId/items/:itemId/attachProduct",
  async (req, res) => {
    const userId = Number(req.params.userId);
    const listId = Number(req.params.listId);
    const itemId = Number(req.params.itemId);

    const productId = Number(req.body?.productId);
    const storeIdRaw = req.body?.storeId;
    const storeId =
      storeIdRaw === undefined ||
      storeIdRaw === null ||
      String(storeIdRaw).trim() === ""
        ? null
        : Number(storeIdRaw);

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !Number.isInteger(listId) ||
      listId <= 0 ||
      !Number.isInteger(itemId) ||
      itemId <= 0 ||
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      return res.status(400).json({ message: "Invalid ids" });
    }

    try {
      // Ensure item belongs to list
      const updated = await pool.query(
        `
      UPDATE shopping_list_items
      SET
        product_id = $1,
        custom_name = NULL,
        store_id = COALESCE($2, store_id)
      WHERE id = $3 AND list_id = $4
      RETURNING id
      `,
        [productId, storeId, itemId, listId],
      );

      if (!updated.rowCount) {
        return res.status(404).json({ message: "Item not found" });
      }

      return res.json({ attached: true });
    } catch (e) {
      console.error("attachProduct error:", e);
      return res
        .status(500)
        .json({ message: "Server error attaching product" });
    }
  },
);

app.put(
  "/user/:userId/shoppingLists/:listId/items/:itemId",
  async (req, res) => {
    const userId = Number(req.params.userId);
    const listId = Number(req.params.listId);
    const itemId = Number(req.params.itemId);

    const storeIdRaw = req.body?.storeId;
    const storeId =
      storeIdRaw === undefined ||
      storeIdRaw === null ||
      String(storeIdRaw) === ""
        ? null
        : Number(storeIdRaw);

    const quantity =
      req.body?.quantity != null
        ? toPositiveInt(req.body.quantity, null)
        : null;

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !Number.isInteger(listId) ||
      listId <= 0 ||
      !Number.isInteger(itemId) ||
      itemId <= 0
    ) {
      return res.status(400).json({ message: "Invalid ids" });
    }

    try {
      await assertUserOwnsList(userId, listId);
      await assertStoreVisibleToUser(userId, storeId);

      const r = await pool.query(
        `
      SELECT id
      FROM shopping_list_items
      WHERE id = $1 AND list_id = $2
      LIMIT 1
      `,
        [itemId, listId],
      );
      if (!r.rows.length) throw new HttpError(404, "Item not found");

      const updates = [];
      const params = [];
      let i = 1;

      if (req.body?.storeId !== undefined) {
        updates.push(`store_id = $${i++}`);
        params.push(storeId);
      }
      if (quantity !== null) {
        updates.push(`quantity = $${i++}`);
        params.push(quantity);
      }

      if (!updates.length) return res.json({ updated: true });

      params.push(itemId, listId);

      await pool.query(
        `
      UPDATE shopping_list_items
      SET ${updates.join(", ")}
      WHERE id = $${i++} AND list_id = $${i++}
      `,
        params,
      );

      res.json({ updated: true });
    } catch (e) {
      console.error("update shopping list item error:", e);
      res
        .status(e.status || 500)
        .json({ message: e.message || "Server error updating item" });
    }
  },
);

app.delete(
  "/user/:userId/shoppingLists/:listId/items/:itemId",
  async (req, res) => {
    const userId = Number(req.params.userId);
    const listId = Number(req.params.listId);
    const itemId = Number(req.params.itemId);

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !Number.isInteger(listId) ||
      listId <= 0 ||
      !Number.isInteger(itemId) ||
      itemId <= 0
    ) {
      return res.status(400).json({ message: "Invalid ids" });
    }

    try {
      await assertUserOwnsList(userId, listId);

      const del = await pool.query(
        `DELETE FROM shopping_list_items WHERE id = $1 AND list_id = $2`,
        [itemId, listId],
      );

      if (del.rowCount === 0) throw new HttpError(404, "Item not found");

      res.json({ deleted: true });
    } catch (e) {
      console.error("delete shopping list item error:", e);
      res
        .status(e.status || 500)
        .json({ message: e.message || "Server error deleting item" });
    }
  },
);

/**
 * DELETE (safe): migrate references to "No store", then delete the store
 * DELETE /user/:userId/stores/:storeId/safe
 *
 * Body (optional): { deletePriceHistory?: boolean }
 * - If true: delete prices instead of migrating them.
 */
app.delete("/user/:userId/stores/:storeId/safe", async (req, res) => {
  const userId = Number(req.params.userId);
  const storeId = Number(req.params.storeId);
  const deletePriceHistory = req.body?.deletePriceHistory === true;

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(storeId) ||
    storeId <= 0
  ) {
    return res.status(400).json({ message: "Invalid userId or storeId" });
  }

  const client = await pool.connect();
  try {
    // Must exist, must be non-system, must belong to user
    await assertStoreOwnedByUser(userId, storeId);

    const noStoreId = await getNoStoreId();

    // If they're trying to delete the No store record, block
    if (Number(storeId) === Number(noStoreId)) {
      return res
        .status(400)
        .json({ message: "Cannot delete the No store record" });
    }

    await client.query("BEGIN");

    // 1) Migrate shopping_list_items -> noStoreId
    const sli = await client.query(
      `
      UPDATE shopping_list_items
      SET store_id = $1
      WHERE store_id = $2
      RETURNING id
      `,
      [noStoreId, storeId],
    );

    // 2) Migrate user_products -> noStoreId
    // Important: user_products.store_id is a FK to product_store(product_id, store_id)
    // So we must ensure product_store has (product_id, noStoreId) for any product being moved.
    const productsToMoveRes = await client.query(
      `
      SELECT DISTINCT product_id
      FROM user_products
      WHERE store_id = $1
      `,
      [storeId],
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
      // rowCount is not always meaningful for INSERT..SELECT with ON CONFLICT in all drivers,
      // but we keep it as a best-effort metric.
      ensuredProductStoreLinks = ins.rowCount ?? 0;
    }

    const up = await client.query(
      `
      UPDATE user_products
      SET store_id = $1
      WHERE store_id = $2
      RETURNING id
      `,
      [noStoreId, storeId],
    );

    // 3) Handle user_product_prices
    let uppMoved = 0;
    let uppDeleted = 0;

    if (deletePriceHistory) {
      const del = await client.query(
        `DELETE FROM user_product_prices WHERE store_id = $1 RETURNING id`,
        [storeId],
      );
      uppDeleted = del.rowCount;
    } else {
      // Merge into noStoreId with "keep most recent updated_at"
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
        [noStoreId, storeId],
      );

      const delOld = await client.query(
        `DELETE FROM user_product_prices WHERE store_id = $1 RETURNING id`,
        [storeId],
      );
      uppMoved = delOld.rowCount;
    }

    // 4) Migrate product_store links: move storeId -> noStoreId safely (collision-safe)
    // This prevents "losing" product_store associations and keeps the DB consistent.
    const psInserted = await client.query(
      `
      INSERT INTO product_store (product_id, store_id)
      SELECT product_id, $1
      FROM product_store
      WHERE store_id = $2
      ON CONFLICT (product_id, store_id) DO NOTHING
      `,
      [noStoreId, storeId],
    );

    const psDeleted = await client.query(
      `DELETE FROM product_store WHERE store_id = $1 RETURNING product_id`,
      [storeId],
    );

    // 5) Delete the store itself
    const delStore = await client.query(
      `DELETE FROM stores WHERE id = $1 AND is_system = false AND owner_user_id = $2`,
      [storeId, userId],
    );

    await client.query("COMMIT");

    return res.json({
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
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("safe delete store error:", e);
    return res
      .status(e.status || 500)
      .json({ message: e.message || "Server error deleting store safely" });
  } finally {
    client.release();
  }
});

app.get("/user/:userId/shoppingLists/:listId", async (req, res) => {
  const userId = Number(req.params.userId);
  const listId = Number(req.params.listId);

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(listId) ||
    listId <= 0
  ) {
    return res.status(400).json({ message: "Invalid userId or listId" });
  }

  try {
    const list = await assertUserOwnsList(userId, listId);

    const r = await pool.query(
      `
      SELECT
        sli.id AS item_id,
        sli.product_id,
        sli.custom_name,
        sli.store_id,
        sli.quantity,
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
      [userId, listId],
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
        unit_price: hasKnownPrice ? unitPrice : null,
        line_total: lineTotal,
      };
    });

    const groupsMap = new Map();

    for (const it of items) {
      const key = it.store_id === null ? "null" : String(it.store_id);
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

    res.json({
      list: {
        id: Number(list.id),
        name: String(list.name),
        created_at: list.created_at,
        updated_at: list.updated_at,
      },
      groups,
      total_known_price,
      unknown_price_count,
    });
  } catch (e) {
    console.error("get shopping list error:", e);
    res
      .status(e.status || 500)
      .json({ message: e.message || "Server error loading shopping list" });
  }
});

/**
 * POST: Scan barcode
 */
app.post("/scan", async (req, res) => {
  const { barcode, userId } = req.body;
  const uid = parseOptionalUserId(userId);

  const cleanBarcode = String(barcode ?? "").trim();
  if (!cleanBarcode) {
    return res.status(400).json({ found: false, message: "Missing barcode" });
  }

  try {
    // ----------------------------
    // 1) Check local DB (scoped to user if provided)
    // ----------------------------
    const localProduct = uid
      ? await pool.query(
          `
          SELECT id, name
          FROM products
          WHERE barcode = $1
            AND (is_system = true OR owner_user_id = $2)
          LIMIT 1
          `,
          [cleanBarcode, uid],
        )
      : await pool.query(
          `
          SELECT id, name
          FROM products
          WHERE barcode = $1
            AND is_system = true
          LIMIT 1
          `,
          [cleanBarcode],
        );

    if (localProduct.rows.length > 0) {
      const product = localProduct.rows[0];

      // Prefer returning a "best" store for convenience, but ONLY stores visible to user
      const storeJoin = uid
        ? await pool.query(
            `
            SELECT s.id AS store_id, s.name AS store_name
            FROM product_store ps
            JOIN stores s ON s.id = ps.store_id
            WHERE ps.product_id = $1
              AND (s.is_system = true OR s.owner_user_id = $2)
            ORDER BY s.is_system DESC, s.name ASC
            LIMIT 1
            `,
            [product.id, uid],
          )
        : await pool.query(
            `
            SELECT s.id AS store_id, s.name AS store_name
            FROM product_store ps
            JOIN stores s ON s.id = ps.store_id
            WHERE ps.product_id = $1
              AND s.is_system = true
            ORDER BY s.name ASC
            LIMIT 1
            `,
            [product.id],
          );

      const storeRow = storeJoin.rows[0] || null;

      return res.json({
        found: true,
        product_id: Number(product.id),
        product_name: String(product.name),
        store_id: storeRow ? Number(storeRow.store_id) : null,
        store_name: storeRow ? String(storeRow.store_name) : null,
        needs_classification: false, // critical: never route to classification for existing products
        barcode: cleanBarcode,
      });
    }

    // ----------------------------
    // 2) Not in DB -> OpenFoodFacts
    // ----------------------------
    const offRes = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(
        cleanBarcode,
      )}.json`,
    );

    if (!offRes.ok) {
      const txt = await offRes.text().catch(() => "");
      console.warn("OpenFoodFacts non-OK:", offRes.status, txt);
      return res.json({
        found: false,
        message: "Barcode lookup failed",
        barcode: cleanBarcode,
      });
    }

    const offData = await offRes.json();

    if (!offData || offData.status === 0) {
      return res.json({ found: false, barcode: cleanBarcode });
    }

    const name = String(
      offData.product?.product_name ||
        offData.product?.generic_name ||
        "Unnamed Product",
    ).trim();

    return res.json({
      found: true,
      product_id: null,
      product_name: name || "Unnamed Product",
      store_id: null,
      store_name: null,
      needs_classification: true, // only true for unknown products
      barcode: cleanBarcode,
    });
  } catch (err) {
    console.error("Scan error:", err);
    return res
      .status(500)
      .json({ found: false, message: "Server error while scanning" });
  }
});

/**
 * POST: Create product
 */
app.post("/products/create", async (req, res) => {
  const { userId, name, barcode, foodTypeId, storeId } = req.body;
  const uid = parseOptionalUserId(userId);

  if (!uid) {
    return res.status(400).json({
      message: "Missing userId (required after scoped products update)",
    });
  }
  if (!name || !foodTypeId) {
    return res.status(400).json({ message: "Missing required fields" });
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
      return res
        .status(400)
        .json({ message: "Invalid food type for this user" });
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
        const allowExisting = req.body.allowExisting === true;

        if (!allowExisting) {
          return res.json({
            barcode_conflict: true,
            existing_product_id: existing.rows[0].id,
            existing_product_name: existing.rows[0].name,
          });
        }

        let storeName = null;
        if (storeId) {
          const storeNameRes = await pool.query(
            `SELECT name FROM stores WHERE id = $1 LIMIT 1`,
            [storeId],
          );
          storeName = storeNameRes.rows[0]?.name ?? null;
        }

        return res.json({
          product_id: existing.rows[0].id,
          product_name: existing.rows[0].name,
          store_id: storeId ?? null,
          store_name: storeName,
        });
      }
    }

    const insertProduct = await pool.query(
      `
      INSERT INTO products (name, barcode, food_type, is_system, owner_user_id)
      VALUES ($1, $2, $3, false, $4)
      RETURNING id
      `,
      [String(name).trim(), barcode ?? null, foodTypeId, uid],
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

    return res.json({
      product_id: newProductId,
      product_name: String(name).trim(),
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
  const { userId, productId, storeId, expiryDate, price, expiryPeriodDays } =
    req.body;

  if (!userId || !productId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    let effectiveStoreId = null;

    if (
      storeId === undefined ||
      storeId === null ||
      String(storeId).trim() === ""
    ) {
      effectiveStoreId = await getNoStoreId();
    } else {
      const sid = Number(storeId);
      if (!Number.isFinite(sid) || sid <= 0) {
        return res.status(400).json({ message: "Invalid storeId" });
      }

      const uid = parseOptionalUserId(userId);
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
        return res.status(400).json({ message: "Invalid store for this user" });
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
        return res.status(400).json({ message: "Invalid expiryPeriodDays" });
      }
      expiryPeriodToStore = n;
    }

    await pool.query(
      `
      INSERT INTO product_store (product_id, store_id)
      VALUES ($1, $2)
      ON CONFLICT (product_id, store_id) DO NOTHING
      `,
      [productId, effectiveStoreId],
    );

    const inserted = await pool.query(
      `
      INSERT INTO user_products (user_id, product_id, store_id, expiry_date, expiry_period_days, notified)
      VALUES ($1, $2, $3, $4, $5, false)
      RETURNING id, expiry_period_days, expiry_date
      `,
      [
        userId,
        productId,
        effectiveStoreId,
        expiryDate ?? null,
        expiryPeriodToStore,
      ],
    );

    const upRow = inserted.rows[0];

    const userPrefRes = await pool.query(
      `SELECT notification_period_preference FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );

    const userPref = userPrefRes.rows.length
      ? Number(userPrefRes.rows[0].notification_period_preference ?? 0)
      : 0;

    let days_left = null;
    if (upRow.expiry_date) {
      const daysLeftRes = await pool.query(
        `SELECT ($1::date - CURRENT_DATE) AS days_left`,
        [upRow.expiry_date],
      );
      days_left = Number(daysLeftRes.rows[0].days_left);
    }

    const expiry_period_days = Number(upRow.expiry_period_days ?? 0);
    const effective_period_days =
      expiry_period_days > 0 ? expiry_period_days : userPref;

    if (price !== undefined && price !== null) {
      await pool.query(
        `
        INSERT INTO user_product_prices (user_id, product_id, store_id, last_price, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, product_id, store_id)
        DO UPDATE SET
          last_price = EXCLUDED.last_price,
          updated_at = CURRENT_TIMESTAMP
        `,
        [userId, productId, effectiveStoreId, price],
      );
    }

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

app.post("/user_products/setExpiryPeriod", async (req, res) => {
  const { userId, productId, storeId, expiryDate, expiryPeriodDays } = req.body;

  const uid = Number(userId);
  const pid = Number(productId);
  const sid =
    storeId === undefined || storeId === null || String(storeId) === ""
      ? null
      : Number(storeId);

  if (
    !Number.isInteger(uid) ||
    uid <= 0 ||
    !Number.isInteger(pid) ||
    pid <= 0
  ) {
    return res.status(400).json({ message: "Invalid userId or productId" });
  }
  if (sid !== null && (!Number.isFinite(sid) || sid <= 0)) {
    return res.status(400).json({ message: "Invalid storeId" });
  }

  let period = 0;
  if (
    expiryPeriodDays !== undefined &&
    expiryPeriodDays !== null &&
    String(expiryPeriodDays).trim() !== ""
  ) {
    const n = Number(expiryPeriodDays);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      return res.status(400).json({ message: "Invalid expiryPeriodDays" });
    }
    period = n;
  }

  const exp =
    expiryDate === undefined
      ? undefined
      : expiryDate === null || String(expiryDate).trim() === ""
        ? null
        : String(expiryDate).trim();

  if (exp !== undefined && exp !== null) {
    const okFormat = /^\d{4}-\d{2}-\d{2}$/.test(exp);
    if (!okFormat) {
      return res
        .status(400)
        .json({ message: "Invalid expiryDate (YYYY-MM-DD or null)" });
    }
  }

  try {
    const q = `
      UPDATE user_products
      SET expiry_period_days = $1
      WHERE user_id = $2
        AND product_id = $3
        AND store_id IS NOT DISTINCT FROM $4
        AND ($5::date IS NULL OR expiry_date IS NOT DISTINCT FROM $5::date)
      RETURNING id
    `;

    const r = await pool.query(q, [
      period,
      uid,
      pid,
      sid,
      exp === undefined ? null : exp,
    ]);
    return res.json({ updated: true, updated_rows: r.rowCount });
  } catch (e) {
    console.error("setExpiryPeriod error:", e);
    return res
      .status(500)
      .json({ message: "Server error updating expiry period" });
  }
});

/**
 * Allow the user to store prices for products per store
 */

app.get("/user/:userId/product/:productId/lastPrice", async (req, res) => {
  const userId = Number(req.params.userId);
  const productId = Number(req.params.productId);

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(productId) ||
    productId <= 0
  ) {
    return res.status(400).json({ message: "Invalid userId or productId" });
  }

  let storeId = null;
  try {
    storeId = parseOptionalStoreId(req.query.storeId);
  } catch (e) {
    return res
      .status(e.status || 400)
      .json({ message: e.message || "Invalid storeId" });
  }

  try {
    const r = await pool.query(
      `
      SELECT last_price
      FROM user_product_prices
      WHERE user_id = $1
        AND product_id = $2
        AND store_id IS NOT DISTINCT FROM $3
      LIMIT 1
      `,
      [userId, productId, storeId],
    );

    res.json({ last_price: r.rows.length ? r.rows[0].last_price : null });
  } catch (err) {
    console.error("Get last price error:", err);
    res.status(500).json({ message: "Server error fetching last price" });
  }
});

app.get("/user/:userId/product/:productId/lastPriceAny", async (req, res) => {
  const userId = Number(req.params.userId);
  const productId = Number(req.params.productId);

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(productId) ||
    productId <= 0
  ) {
    return res.status(400).json({ message: "Invalid userId or productId" });
  }

  try {
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
      [userId, productId],
    );

    if (!r.rows.length) {
      return res.json({ store_id: null, store_name: null, last_price: null });
    }

    return res.json({
      store_id: r.rows[0].store_id ?? null,
      store_name: r.rows[0].store_name ?? null,
      last_price: r.rows[0].last_price ?? null,
    });
  } catch (err) {
    console.error("Get last price any error:", err);
    res.status(500).json({ message: "Server error fetching last price" });
  }
});

app.post(
  "/user/:userId/product/:productId/clearPersonalHistory",
  async (req, res) => {
    const userId = Number(req.params.userId);
    const productId = Number(req.params.productId);
    const confirmDeleteInventory = req.body?.confirmDeleteInventory === true;

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      return res.status(400).json({ message: "Invalid userId or productId" });
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
        [userId, productId],
      );
      const inventoryCount = Number(inv.rows[0]?.n ?? 0);

      const hist = await client.query(
        `
      SELECT COUNT(*)::int AS n
      FROM user_product_prices
      WHERE user_id = $1 AND product_id = $2
      `,
        [userId, productId],
      );
      const historyCount = Number(hist.rows[0]?.n ?? 0);

      if (inventoryCount > 0 && !confirmDeleteInventory) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message:
            "This product exists in your inventory. Clearing history will also delete your current inventory for this product. Confirm to proceed.",
          inventoryCount,
          historyCount,
          requiresConfirmation: true,
        });
      }

      const delHist = await client.query(
        `
      DELETE FROM user_product_prices
      WHERE user_id = $1 AND product_id = $2
      `,
        [userId, productId],
      );

      const delInv = await client.query(
        `
      DELETE FROM user_products
      WHERE user_id = $1 AND product_id = $2
      `,
        [userId, productId],
      );

      await client.query("COMMIT");

      return res.json({
        cleared: true,
        deleted_history_rows: delHist.rowCount,
        deleted_inventory_rows: delInv.rowCount,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("clearPersonalHistory error:", e);
      return res.status(500).json({ message: "Server error clearing history" });
    } finally {
      client.release();
    }
  },
);

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
      [userId, productId, storeId ?? null, qty],
    );

    res.json({ removed: del.rowCount });
  } catch (err) {
    console.error("Remove user_products error:", err);
    res.status(500).json({ message: "Server error removing items" });
  }
});

/**
 * GET: Expiry buckets for a grouped product/store
 * /user_products/buckets?userId=1&productId=2&storeId=3
 * storeId can be omitted/null (No store)
 */
app.get("/user_products/buckets", async (req, res) => {
  const userId = Number(req.query.userId);
  const productId = Number(req.query.productId);
  const storeIdRaw = req.query.storeId;

  const storeId =
    storeIdRaw === undefined || storeIdRaw === null || String(storeIdRaw) === ""
      ? null
      : Number(storeIdRaw);

  if (!userId || !productId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const r = await pool.query(
      `
      SELECT
        expiry_date,
        COUNT(*)::int AS quantity
      FROM user_products
      WHERE user_id = $1
        AND product_id = $2
        AND store_id IS NOT DISTINCT FROM $3
      GROUP BY expiry_date
      ORDER BY expiry_date ASC NULLS LAST;
      `,
      [userId, productId, storeId],
    );

    res.json(r.rows);
  } catch (err) {
    console.error("Buckets fetch error:", err);
    res.status(500).json({ message: "Server error loading buckets" });
  }
});

/**
 * POST: Remove N items from a SPECIFIC expiry bucket
 * Body: { userId, productId, storeId, expiryDate, quantity }
 * expiryDate can be null (removes from "no expiry" bucket)
 */
app.post("/user_products/removeByExpiry", async (req, res) => {
  const { userId, productId, storeId, expiryDate, quantity } = req.body;
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
          AND expiry_date IS NOT DISTINCT FROM $4
        ORDER BY id ASC
        LIMIT $5
      )
      RETURNING id
      `,
      [userId, productId, storeId ?? null, expiryDate ?? null, qty],
    );

    res.json({ removed: del.rowCount });
  } catch (err) {
    console.error("RemoveByExpiry error:", err);
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
      [id],
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
 * POST: Change (move) ALL items from one expiry bucket to another
 * Body: { userId, productId, storeId, fromExpiryDate, toExpiryDate }
 * fromExpiryDate can be null (the "no expiry" bucket)
 * toExpiryDate can be null (move into "no expiry" bucket)
 */
app.post("/user_products/changeBucketExpiry", async (req, res) => {
  function normalizeExpiryDateInput(v) {
    // Accept null/blank as null
    if (v === undefined) return undefined;
    if (v === null) return null;

    const s = String(v).trim();
    if (!s) return null;

    // If already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // If ISO string or timestamp-like: take first 10 chars if it starts with YYYY-MM-DD
    // e.g. 2026-03-05T00:00:00.000Z or 2026-03-05 00:00:00
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

    // Otherwise keep as-is (will be rejected below)
    return s;
  }

  const { userId, productId, storeId, fromExpiryDate, toExpiryDate } = req.body;

  const uid = Number(userId);
  const pid = Number(productId);

  const sid =
    storeId === undefined || storeId === null || String(storeId) === ""
      ? null
      : Number(storeId);

  if (
    !Number.isInteger(uid) ||
    uid <= 0 ||
    !Number.isInteger(pid) ||
    pid <= 0
  ) {
    return res.status(400).json({ message: "Invalid userId or productId" });
  }

  if (sid !== null && (!Number.isFinite(sid) || sid <= 0)) {
    return res.status(400).json({ message: "Invalid storeId" });
  }

  const fromExp = normalizeExpiryDateInput(fromExpiryDate);
  const toExp = normalizeExpiryDateInput(toExpiryDate);

  if (fromExp === undefined || toExp === undefined) {
    return res
      .status(400)
      .json({ message: "Missing fromExpiryDate or toExpiryDate" });
  }

  if (fromExp !== null) {
    const okFormat = /^\d{4}-\d{2}-\d{2}$/.test(fromExp);
    if (!okFormat) {
      return res
        .status(400)
        .json({ message: "Invalid fromExpiryDate (YYYY-MM-DD or null)" });
    }
  }

  if (toExp !== null) {
    const okFormat = /^\d{4}-\d{2}-\d{2}$/.test(toExp);
    if (!okFormat) {
      return res
        .status(400)
        .json({ message: "Invalid toExpiryDate (YYYY-MM-DD or null)" });
    }
  }

  try {
    const r = await pool.query(
      `
      UPDATE user_products
      SET expiry_date = $1
      WHERE user_id = $2
        AND product_id = $3
        AND store_id IS NOT DISTINCT FROM $4
        AND expiry_date IS NOT DISTINCT FROM $5
      `,
      [toExp, uid, pid, sid, fromExp],
    );

    return res.json({ updated: true, moved_rows: r.rowCount });
  } catch (err) {
    console.error("changeBucketExpiry error:", err);
    return res
      .status(500)
      .json({ message: "Server error changing bucket expiry" });
  }
});

/**
 * POST: Update store for a grouped user product (moves all rows), and optionally set last price
 * Body: { userId, productId, fromStoreId, toStoreId, lastPrice }
 *
 * Notes:
 * - fromStoreId and toStoreId can be null (represents "No store" grouping)
 * - Changing store will automatically regroup because the rows are moved
 * - lastPrice is optional; if provided it is upserted into user_product_prices for the NEW store
 */
app.post("/user_products/updateStoreAndPrice", async (req, res) => {
  const { userId, productId, fromStoreId, toStoreId, lastPrice } = req.body;

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
    return res.status(400).json({ message: "Invalid userId or productId" });
  }

  if (fromSid !== null && (!Number.isFinite(fromSid) || fromSid <= 0)) {
    return res.status(400).json({ message: "Invalid fromStoreId" });
  }
  if (toSid !== null && (!Number.isFinite(toSid) || toSid <= 0)) {
    return res.status(400).json({ message: "Invalid toStoreId" });
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
      return res.status(400).json({ message: "Invalid lastPrice" });
    }
    priceToSet = n;
    hasPrice = true;
  }

  // Validate destination store belongs to user or is system, if not null
  if (toSid !== null) {
    try {
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
        return res.status(400).json({ message: "Invalid store for this user" });
      }
    } catch (e) {
      console.error("updateStoreAndPrice store validation error:", e);
      return res.status(500).json({ message: "Server error validating store" });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure (product_id, store_id) exists in product_store to satisfy FK on user_products
    // If it's missing, the UPDATE below will fail with a FK violation.
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

    // Move ALL inventory rows for this product+fromStore to new store
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

    // Upsert price for the NEW store (if provided)
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

    return res.json({
      updated: true,
      moved_rows: moved.rowCount,
      store_id: toSid,
      store_name: storeName,
      price_updated: hasPrice,
    });
  } catch (e) {
    await client.query("ROLLBACK");

    // Provide a clearer message for FK issues (common cause here is product_store missing)
    const msg = String(e?.message || "");
    if (
      msg.includes("fk_user_product_store") ||
      msg.includes("violates foreign key constraint")
    ) {
      console.error("updateStoreAndPrice FK error:", e);
      return res.status(400).json({
        message:
          "Cannot move to that store for this product (missing product-store link).",
      });
    }

    console.error("updateStoreAndPrice error:", e);
    return res
      .status(500)
      .json({ message: "Server error updating store/price" });
  } finally {
    client.release();
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
      [userId],
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      notification_period_preference: Number(
        r.rows[0].notification_period_preference ?? 0,
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
      [pref, userId],
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
      [userId, override],
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
      [userId],
    );

    res.json(
      r.rows.map((row) => ({
        ...row,
        days_left: Number(row.days_left),
        effective_period_days: Number(row.effective_period_days),
      })),
    );
  } catch (err) {
    console.error("Pending notifications error:", err);
    res
      .status(500)
      .json({ message: "Server error loading pending notifications" });
  }
});

app.get("/user/:userId/expiringSoon", async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Invalid userId" });
  }

  try {
    const r = await pool.query(
      `
      WITH rows AS (
        SELECT
          up.user_id,
          up.product_id,
          up.store_id,
          up.expiry_date,
          COALESCE(up.expiry_period_days, 0) AS expiry_period_days,
          COALESCE(u.notification_period_preference, 0) AS user_pref_days,
          CASE
            WHEN COALESCE(up.expiry_period_days, 0) > 0 THEN up.expiry_period_days
            ELSE COALESCE(u.notification_period_preference, 0)
          END AS effective_period_days,
          (up.expiry_date::date - CURRENT_DATE) AS days_left
        FROM user_products up
        JOIN users u ON u.id = up.user_id
        WHERE up.user_id = $1
          AND up.expiry_date IS NOT NULL
      ),
      filtered AS (
        SELECT *
        FROM rows
        WHERE days_left <= effective_period_days
      ),
      grouped AS (
        SELECT
          product_id,
          store_id,
          COUNT(*)::int AS quantity,
          MIN(expiry_date) AS nearest_expiry
        FROM filtered
        GROUP BY product_id, store_id
      )
      SELECT
        g.product_id,
        p.name AS product_name,
        g.store_id,
        s.name AS store_name,
        g.quantity,
        g.nearest_expiry,
        (g.nearest_expiry::date - CURRENT_DATE) AS days_left,
        CASE
          WHEN COALESCE(f.expiry_period_days, 0) > 0 THEN f.expiry_period_days
          ELSE COALESCE(f.user_pref_days, 0)
        END AS effective_period_days
      FROM grouped g
      JOIN products p ON p.id = g.product_id
      LEFT JOIN stores s ON s.id = g.store_id
      JOIN LATERAL (
        SELECT expiry_period_days, user_pref_days
        FROM filtered f2
        WHERE f2.product_id = g.product_id
          AND f2.store_id IS NOT DISTINCT FROM g.store_id
        ORDER BY f2.expiry_date ASC
        LIMIT 1
      ) f ON true
      ORDER BY days_left ASC, product_name ASC;
      `,
      [userId],
    );

    res.json(
      r.rows.map((row) => ({
        product_id: Number(row.product_id),
        product_name: String(row.product_name),
        store_id: row.store_id === null ? null : Number(row.store_id),
        store_name: row.store_name ?? null,
        quantity: Number(row.quantity),
        nearest_expiry: row.nearest_expiry,
        days_left: Number(row.days_left),
        effective_period_days: Number(row.effective_period_days),
      })),
    );
  } catch (e) {
    console.error("expiringSoon error:", e);
    res
      .status(500)
      .json({ message: "Server error loading expiring soon list" });
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
        MIN(up.expiry_date) AS nearest_expiry,
        upp.last_price AS last_price
      FROM user_products up
      JOIN products p ON p.id = up.product_id
      LEFT JOIN stores s ON s.id = up.store_id
      LEFT JOIN user_product_prices upp
        ON upp.user_id = up.user_id
      AND upp.product_id = up.product_id
      AND upp.store_id IS NOT DISTINCT FROM up.store_id
      WHERE up.user_id = $1 AND p.food_type = $2
      GROUP BY
        p.id,
        p.name,
        s.id,
        s.name,
        upp.last_price
      ORDER BY p.name;
    `;

    const result = await pool.query(q, [userId, foodTypeId]);
    res.json(result.rows);
  } catch (err) {
    console.error("User product fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /products/search?userId=1&q=coleslaw&limit=30&offset=0

/**
 * SIGNUP AND LOGIN
 */

app.post("/signup", async (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!username) return res.status(400).json({ message: "Missing username" });
  if (username.length > 30)
    return res.status(400).json({ message: "Username too long (max 30)" });

  if (!password || password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" });
  }

  try {
    // prevent duplicates (you already have unique constraint on username)
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const r = await pool.query(
      `
      INSERT INTO users (username, password_hash, notification_period_preference)
      VALUES ($1, $2, 0)
      RETURNING id, username
      `,
      [username, hash],
    );

    return res.status(201).json({
      user_id: r.rows[0].id,
      username: r.rows[0].username,
    });
  } catch (e) {
    if (e?.code === "23505") {
      return res.status(409).json({ message: "Username already exists" });
    }
    console.error("Signup error:", e);
    return res.status(500).json({ message: "Server error creating account" });
  }
});

app.post("/login", async (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!username || !password) {
    return res.status(400).json({ message: "Missing username or password" });
  }

  try {
    const r = await pool.query(
      `
      SELECT id, username, password, password_hash
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username],
    );

    if (!r.rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const row = r.rows[0];

    // Preferred: bcrypt hash
    if (row.password_hash) {
      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) return res.status(401).json({ message: "Invalid credentials" });

      return res.json({ user_id: row.id, username: row.username });
    }

    // Temporary legacy fallback: plaintext password
    if (row.password && String(row.password) === password) {
      // Optional: auto-migrate on successful login
      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
        hash,
        row.id,
      ]);

      return res.json({ user_id: row.id, username: row.username });
    }

    return res.status(401).json({ message: "Invalid credentials" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
