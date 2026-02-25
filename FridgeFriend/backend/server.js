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

/**
 * -------------------------
 * Store helpers
 * -------------------------
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
    [userId, productId, storeId ?? null]
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
    let out = normalizeText(s).replace(/\b(please|tonight|today)\b/g, "").trim();
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

    const nonModifierCount = afterTokens.filter((t) => !MODIFIERS.has(t)).length;

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
      (r) => normalizeText(r?.title || "") === dishNorm
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
        (r) => normalizeText(r?.title || "") === dishNorm
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
    [userId, recipeId]
  );
  if (!r.rows.length) throw new HttpError(403, "Not saved by this user");
}

/** ✅ NEW: get recipe meta for auth decisions */
async function getRecipeMeta(recipeId) {
  const r = await pool.query(
    `SELECT id, source, created_by_user_id FROM recipes WHERE id = $1 LIMIT 1`,
    [recipeId]
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
    [userId]
  );
  return r.rows.map((row) => String(row.name));
}

async function getRecipeWithIngredients(recipeId) {
  const r = await pool.query(
    `
    SELECT id, title, source, external_id, source_url, created_by_user_id
    FROM recipes
    WHERE id = $1
    LIMIT 1
    `,
    [recipeId]
  );
  if (!r.rows.length) return null;

  const ing = await pool.query(
    `
    SELECT id, recipe_id, name, amount, unit, position
    FROM recipe_ingredients
    WHERE recipe_id = $1
    ORDER BY position ASC, id ASC
    `,
    [recipeId]
  );

  return { ...r.rows[0], ingredients: ing.rows };
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const countRes = await client.query(
      `SELECT COUNT(*)::int AS c FROM recipe_ingredients WHERE recipe_id = $1`,
      [recipeRow.id]
    );
    const c = Number(countRes.rows[0]?.c ?? 0);

    if (c === 0) {
      let pos = 0;
      for (const raw of ingList) {
        const name = String(raw || "").trim();
        if (!name) continue;
        pos++;
        await client.query(
          `
          INSERT INTO recipe_ingredients (recipe_id, product_id, name, amount, unit, position)
          VALUES ($1, NULL, $2, NULL, NULL, $3)
          `,
          [recipeRow.id, name, pos]
        );
      }
    }

    if (!recipeRow.source_url && info.url) {
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
    let createdNew = false;

    if (externalId) {
      const up = await client.query(
        `
        INSERT INTO recipes (title, source, external_id, source_url, created_by_user_id, nutrition_json)
        VALUES ($1, $2, $3, $4, NULL, $5)
        ON CONFLICT (source, external_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          source_url = COALESCE(EXCLUDED.source_url, recipes.source_url),
          nutrition_json = COALESCE(EXCLUDED.nutrition_json, recipes.nutrition_json)
        RETURNING id, (xmax = 0) AS inserted
        `,
        [title, source, externalId, url, normalizedNutrition]
      );

      recipeId = Number(up.rows[0].id);
      createdNew = Boolean(up.rows[0].inserted);
    } else {
      const ins = await client.query(
        `
        INSERT INTO recipes (title, source, external_id, source_url, created_by_user_id, nutrition_json)
        VALUES ($1, 'custom', NULL, $2, $3, $4)
        RETURNING id
        `,
        [title, url, userId, normalizedNutrition]
      );

      recipeId = Number(ins.rows[0].id);
      createdNew = true;
    }

    // Ingredients are NAME-only, min 3 chars, unique
    const safeIngredients = cleanIngredientStrings(ingredientsRaw);

    if (safeIngredients.length) {
      const countRes = await client.query(
        `SELECT COUNT(*)::int AS c FROM recipe_ingredients WHERE recipe_id = $1`,
        [recipeId]
      );
      const currentCount = Number(countRes.rows[0]?.c ?? 0);

      if (createdNew || currentCount === 0) {
        let pos = 0;
        for (const name of safeIngredients) {
          pos++;
          await client.query(
            `
            INSERT INTO recipe_ingredients (recipe_id, product_id, name, amount, unit, position)
            VALUES ($1, NULL, $2, NULL, NULL, $3)
            `,
            [recipeId, name, pos]
          );
        }
      }
    }

    await client.query(
      `
      INSERT INTO user_saved_recipes (user_id, recipe_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, recipe_id) DO NOTHING
      `,
      [userId, recipeId]
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

  if (!q) return res.json([]);

  try {
    if (userId) {
      const r = await pool.query(
        `
        SELECT id, name
        FROM products
        WHERE (is_system = true OR owner_user_id = $1)
          AND name ILIKE $2
        ORDER BY name ASC
        LIMIT 25
        `,
        [userId, `%${q}%`]
      );
      return res.json(
        r.rows.map((row) => ({ id: Number(row.id), name: String(row.name) }))
      );
    }

    const r = await pool.query(
      `
      SELECT id, name
      FROM products
      WHERE is_system = true
        AND name ILIKE $1
      ORDER BY name ASC
      LIMIT 25
      `,
      [`%${q}%`]
    );

    res.json(
      r.rows.map((row) => ({ id: Number(row.id), name: String(row.name) }))
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
      externalId: recipe.external_id != null ? String(recipe.external_id) : null,
      url: recipe.url ? String(recipe.url) : null,
      ingredientsRaw: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
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
      [userId]
    );

    res.json(
      r.rows.map((row) => ({
        id: Number(row.id),
        title: String(row.title),
        source: String(row.source),
        external_id: row.external_id ?? null,
        url: row.source_url ?? null,
        saved_at: row.saved_at,
      }))
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
      [recipeId]
    );
    if (!meta.rows.length) {
      return res.status(404).json({ message: "Recipe not found" });
    }

    const row = meta.rows[0];

    // If cached nutrition exists, still fetch servings (unless not Spoonacular)
    if (row.nutrition_json) {
      let servings = null;

      if (String(row.source) === "spoonacular" && row.external_id) {
        const externalIdNum = Number(row.external_id);
        if (Number.isFinite(externalIdNum)) {
          try {
            const info = await spoonFetchJson(`/recipes/${externalIdNum}/information`, {
              includeNutrition: false,
            });
            servings = info?.servings ?? null;
          } catch (e) {
            // keep servings null if Spoonacular call fails
            console.warn("Servings fetch (cached nutrition) failed:", e?.message ?? e);
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
      {}
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

    if (meta.source !== "custom" || Number(meta.created_by_user_id) !== userId) {
      return res.status(403).json({
        message: "Only custom recipes you created can be edited.",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE recipes SET title = $1, source_url = $2 WHERE id = $3`,
        [newTitle, newUrl, recipeId]
      );

      await client.query(`DELETE FROM recipe_ingredients WHERE recipe_id = $1`, [
        recipeId,
      ]);

      let pos = 0;
      for (const name of newIngredients) {
        pos++;
        await client.query(
          `
          INSERT INTO recipe_ingredients (recipe_id, product_id, name, amount, unit, position)
          VALUES ($1, NULL, $2, NULL, NULL, $3)
          `,
          [recipeId, name, pos]
        );
      }

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
      [userId, recipeId]
    );

    if (delSaved.rowCount === 0) {
      return res.status(404).json({ message: "Recipe was not saved" });
    }

    const meta = await getRecipeMeta(recipeId);
    if (!meta) return res.json({ removed: true, deleted_recipe: false });

    if (meta.source === "custom" && Number(meta.created_by_user_id) === userId) {
      const c = await pool.query(
        `SELECT COUNT(*)::int AS n FROM user_saved_recipes WHERE recipe_id = $1`,
        [recipeId]
      );
      const n = Number(c.rows[0]?.n ?? 0);

      if (n === 0) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `DELETE FROM recipe_ingredients WHERE recipe_id = $1`,
            [recipeId]
          );
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
      return res.status(400).json({ reply: "Missing userId or message.", recipes: [] });
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
      nutritionWidget = await spoonFetchJson(`/recipes/${hit.id}/nutritionWidget.json`, {});
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
        [userId]
      );
      return res.json(result.rows);
    }

    const result = await pool.query(
      `
      SELECT id, name, is_system, owner_user_id
      FROM categories
      WHERE is_system = true
      ORDER BY id ASC
      `
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
        [categoryId, userId]
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
        [categoryId]
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
        [categoryId, userId]
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
      [categoryId]
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
  const { barcode, userId } = req.body;
  const uid = parseOptionalUserId(userId);

  if (!barcode) {
    return res.status(400).json({ found: false, message: "Missing barcode" });
  }

  try {
    let localProduct;

    if (uid) {
      localProduct = await pool.query(
        `
        SELECT id, name
        FROM products
        WHERE barcode = $1
          AND (is_system = true OR owner_user_id = $2)
        LIMIT 1
        `,
        [barcode, uid]
      );
    } else {
      // system-only fallback if userId not provided
      localProduct = await pool.query(
        `
        SELECT id, name
        FROM products
        WHERE barcode = $1
          AND is_system = true
        LIMIT 1
        `,
        [barcode]
      );
    }

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
  const { userId, name, barcode, foodTypeId, storeId } = req.body;
  const uid = parseOptionalUserId(userId);

  if (!uid) {
    return res
      .status(400)
      .json({ message: "Missing userId (required after scoped products update)" });
  }
  if (!name || !foodTypeId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Ensure the food type exists AND is visible to the user
    const ft = await pool.query(
      `
      SELECT id
      FROM food_types
      WHERE id = $1
        AND (is_system = true OR owner_user_id = $2)
      LIMIT 1
      `,
      [foodTypeId, uid]
    );
    if (ft.rows.length === 0) {
      return res.status(400).json({ message: "Invalid food type for this user" });
    }

    // Prevent accidental reuse: if barcode exists in user's scope (or system), require explicit confirmation
    if (barcode) {
      const existing = await pool.query(
        `
        SELECT id, name
        FROM products
        WHERE barcode = $1
          AND (is_system = true OR owner_user_id = $2)
        LIMIT 1
        `,
        [barcode, uid]
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
            [storeId]
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
      [String(name).trim(), barcode ?? null, foodTypeId, uid]
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
  const { userId, productId, storeId, expiryDate, price } = req.body;

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
        [userId, productId, effectiveStoreId, price]
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

/**
 * Allow the user to store prices for products per store
 */

app.get("/user/:userId/product/:productId/lastPrice", async (req, res) => {
  const { userId, productId } = req.params;
  const { storeId } = req.query;

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
      [userId, productId, storeId ?? null]
    );

    res.json({
      last_price: r.rows.length ? r.rows[0].last_price : null,
    });
  } catch (err) {
    console.error("Get last price error:", err);
    res.status(500).json({ message: "Server error fetching last price" });
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
      notification_period_preference: Number(r.rows[0].notification_period_preference ?? 0),
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
    return res.status(400).json({ message: "Invalid notification_period_preference" });
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
    res.status(500).json({ message: "Server error loading pending notifications" });
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

/**
 * LOGIN
 */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const r = await pool.query("SELECT * FROM users WHERE username = $1 AND password = $2", [
      username,
      password,
    ]);

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