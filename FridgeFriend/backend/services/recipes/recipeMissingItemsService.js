import pool from "../../db.js";
import {
  assertUserSavedRecipe,
  getRecipeWithIngredients,
} from "./recipeService.js";

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

function cleanIngredientStrings(value) {
  const arr = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();

  for (const v of arr) {
    const raw = typeof v === "string" ? v : String(v?.name || "");
    const name = raw.trim();
    if (!name) continue;
    if (name.length < 3) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }

  return out;
}

const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;
const SPOON_BASE = "https://api.spoonacular.com";

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

    let existingArr = null;
    if (existing?.igredients_json !== undefined && existing?.igredients_json !== null) {
      if (typeof existing.igredients_json === "string") {
        try {
          const parsed = JSON.parse(existing.igredients_json);
          existingArr = Array.isArray(parsed) ? parsed : null;
        } catch {
          existingArr = null;
        }
      } else if (Array.isArray(existing.igredients_json)) {
        existingArr = existing.igredients_json;
      }
    }

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

export async function getMissingItems(userId, recipeId) {
  const uid = Number(userId);
  const rid = Number(recipeId);

  await assertUserSavedRecipe(uid, rid);

  let recipe = await getRecipeWithIngredients(rid);
  if (!recipe) {
    const err = new Error("Recipe not found");
    err.statusCode = 404;
    throw err;
  }

  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    await ensureRecipeIngredientsInDb(recipe);
    recipe = await getRecipeWithIngredients(rid);
    if (!recipe) {
      const err = new Error("Recipe not found");
      err.statusCode = 404;
      throw err;
    }
  }

  const inventoryNames = await getUserInventoryItems(uid);

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

export default {
  getMissingItems,
};