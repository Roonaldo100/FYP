import pool from "../../db.js";
import { assertUserSavedRecipe } from "./recipeService.js";

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

export async function getRecipeNutrition(userId, recipeId) {
  const uid = Number(userId);
  const rid = Number(recipeId);

  if (
    !Number.isInteger(uid) ||
    uid <= 0 ||
    !Number.isInteger(rid) ||
    rid <= 0
  ) {
    const err = new Error("Invalid userId or recipeId");
    err.statusCode = 400;
    throw err;
  }

  await assertUserSavedRecipe(uid, rid);

  const meta = await pool.query(
    `SELECT id, source, external_id, title, nutrition_json
     FROM recipes
     WHERE id = $1
     LIMIT 1`,
    [rid],
  );

  if (!meta.rows.length) {
    const err = new Error("Recipe not found");
    err.statusCode = 404;
    throw err;
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
            { includeNutrition: false },
          );
          servings = info?.servings ?? null;
        } catch (e) {
          console.warn("Servings fetch (cached nutrition) failed:", e?.message ?? e);
        }
      }
    }

    return {
      recipe_id: Number(row.id),
      servings,
      nutrition: row.nutrition_json,
      nutrition_updated_at: null,
      cached: true,
    };
  }

  if (String(row.source) !== "spoonacular" || !row.external_id) {
    return {
      recipe_id: Number(row.id),
      servings: null,
      nutrition: null,
      nutrition_updated_at: null,
      cached: true,
    };
  }

  const externalIdNum = Number(row.external_id);
  if (!Number.isFinite(externalIdNum)) {
    const err = new Error("Invalid external_id for Spoonacular recipe");
    err.statusCode = 400;
    throw err;
  }

  const widget = await spoonFetchJson(
    `/recipes/${externalIdNum}/nutritionWidget.json`,
    {},
  );

  const info = await spoonFetchJson(
    `/recipes/${externalIdNum}/information`,
    { includeNutrition: false },
  );

  const servings = info?.servings ?? null;

  await pool.query(`UPDATE recipes SET nutrition_json = $1 WHERE id = $2`, [
    widget,
    rid,
  ]);

  return {
    recipe_id: Number(row.id),
    servings,
    nutrition: widget,
    nutrition_updated_at: null,
    cached: false,
  };
}

export default {
  getRecipeNutrition,
};