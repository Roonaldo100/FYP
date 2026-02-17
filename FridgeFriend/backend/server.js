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

/**
 * -------------------------------
 * CHATBOT HELPERS (NO HARD-CODING)
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
 * Inventory summary for matching (chat use)
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
 * Canonical title selection for “exact-ish” matching (no hardcoding dishes)
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
 * RECIPES (SAVED / CUSTOM) HELPERS + ROUTES
 * -------------------------
 */

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
    SELECT id, title, source, external_id, source_url
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

/**
 * One-time backfill:
 * If a saved Spoonacular recipe has 0 ingredients in DB,
 * fetch once from Spoonacular and store ingredient names in recipe_ingredients.
 */
async function ensureRecipeIngredientsInDb(recipeRow) {
  if (!recipeRow) return;
  if (recipeRow.source !== "spoonacular") return;
  if (!recipeRow.external_id) return;

  const currentCount = Array.isArray(recipeRow.ingredients)
    ? recipeRow.ingredients.length
    : 0;

  if (currentCount > 0) return;

  // Fetch from Spoonacular once
  const info = await spoonGetRecipeInformation(Number(recipeRow.external_id));
  const ingList = Array.isArray(info?.ingredients) ? info.ingredients : [];
  if (!ingList.length) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Race-safe check
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

    // Also store source_url if missing
    if (!recipeRow.source_url && info.url) {
      await client.query(
        `UPDATE recipes SET source_url = $1 WHERE id = $2`,
        [String(info.url), recipeRow.id]
      );
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

  // DB-first: backfill only if DB has no ingredients for Spoonacular recipes
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

/**
 * Shared helper: upsert/insert recipe + insert ingredients (NAME ONLY) + save to user
 * - Ingredients stored as plain names; product_id is always NULL.
 */
async function upsertAndSaveRecipeForUser({
  userId,
  title,
  source,
  externalId,
  url,
  ingredientsRaw,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let recipeId = null;
    let createdNew = false;

    if (externalId) {
      // Upsert external recipe by (source, external_id)
      const up = await client.query(
        `
        INSERT INTO recipes (title, source, external_id, source_url, created_by_user_id)
        VALUES ($1, $2, $3, $4, NULL)
        ON CONFLICT (source, external_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          source_url = COALESCE(EXCLUDED.source_url, recipes.source_url)
        RETURNING id, (xmax = 0) AS inserted
        `,
        [title, source, externalId, url]
      );

      recipeId = Number(up.rows[0].id);
      createdNew = Boolean(up.rows[0].inserted);
    } else {
      // Custom recipe always creates a new row
      const ins = await client.query(
        `
        INSERT INTO recipes (title, source, external_id, source_url, created_by_user_id)
        VALUES ($1, 'custom', NULL, $2, $3)
        RETURNING id
        `,
        [title, url, userId]
      );

      recipeId = Number(ins.rows[0].id);
      createdNew = true;
    }

    // Ingredients are NAME-ONLY now (product_id always NULL)
    const safeIngredients = Array.isArray(ingredientsRaw) ? ingredientsRaw : [];

    if (safeIngredients.length) {
      // Only insert if newly created OR recipe has no ingredients yet
      const countRes = await client.query(
        `SELECT COUNT(*)::int AS c FROM recipe_ingredients WHERE recipe_id = $1`,
        [recipeId]
      );
      const currentCount = Number(countRes.rows[0]?.c ?? 0);

      if (createdNew || currentCount === 0) {
        let pos = 0;
        for (const ing of safeIngredients) {
          pos++;

          const name =
            typeof ing === "string"
              ? ing.trim()
              : String(ing?.name || "").trim();

          if (!name) continue;

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

    // Save to user
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
 * Optional: product search (useful for UI autocomplete)
 * GET /products/search?q=milk
 */
app.get("/products/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);

  try {
    const r = await pool.query(
      `
      SELECT id, name
      FROM products
      WHERE name ILIKE $1
      ORDER BY name ASC
      LIMIT 25
      `,
      [`%${q}%`]
    );

    res.json(r.rows.map((row) => ({ id: Number(row.id), name: String(row.name) })));
  } catch (e) {
    console.error("Product search error:", e);
    res.status(500).json({ message: "Server error searching products" });
  }
});

/**
 * Save recipe (from chatbot)
 * POST /user/:userId/recipes/save
 * Body: { recipe: { title, url, source, external_id, ingredients: string[] } }
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
    });

    res.json({ saved: true, recipe_id: recipeId });
  } catch (e) {
    console.error("Save recipe error:", e);
    res.status(500).json({ message: "Server error saving recipe" });
  }
});

/**
 * Create custom recipe + save it (ingredients are just names)
 * POST /user/:userId/recipes
 * Body: { title, url?, ingredients: string[] }
 */
app.post("/user/:userId/recipes", async (req, res) => {
  const userId = Number(req.params.userId);
  const { title, url, ingredients } = req.body || {};

  if (!userId || !title || !String(title).trim()) {
    return res.status(400).json({ message: "Missing title" });
  }

  try {
    const recipeId = await upsertAndSaveRecipeForUser({
      userId,
      title: String(title).trim(),
      source: "custom",
      externalId: null,
      url: url ? String(url) : null,
      ingredientsRaw: Array.isArray(ingredients) ? ingredients : [],
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
 * Get recipe details (must be saved by user)
 * GET /user/:userId/recipes/:recipeId
 */
app.get("/user/:userId/recipes/:recipeId", async (req, res) => {
  const userId = Number(req.params.userId);
  const recipeId = Number(req.params.recipeId);

  try {
    const saved = await pool.query(
      `SELECT 1 FROM user_saved_recipes WHERE user_id = $1 AND recipe_id = $2 LIMIT 1`,
      [userId, recipeId]
    );
    if (!saved.rows.length) return res.status(403).json({ message: "Not saved by this user" });

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
    res.status(500).json({ message: "Server error loading recipe" });
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
    const saved = await pool.query(
      `SELECT 1 FROM user_saved_recipes WHERE user_id = $1 AND recipe_id = $2 LIMIT 1`,
      [userId, recipeId]
    );
    if (!saved.rows.length) return res.status(403).json({ message: "Not saved by this user" });

    const out = await computeMissingForRecipe(userId, recipeId);
    if (!out) return res.status(404).json({ message: "Recipe not found" });

    res.json(out);
  } catch (e) {
    console.error("Recipe missing error:", e);
    res.status(500).json({ message: "Server error computing missing" });
  }
});

/**
 * -------------------------
 * CHATBOT ROUTE (Spoonacular)
 * -------------------------
 * POST /chat/recipe
 * Body: { userId, message }
 * Response: { reply, recipes: [{title,url,source,external_id,ingredients,used[],missing[]}] }
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
          ingredients: recipe.ingredients, // so Save can persist to DB immediately
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
 * EXISTING ROUTES (unchanged)
 * -------------------------
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
