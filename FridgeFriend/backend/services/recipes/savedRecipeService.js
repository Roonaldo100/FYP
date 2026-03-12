import pool from "../../db.js";

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

export async function upsertAndSaveRecipeForUser({
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

export async function saveRecipeFromPayload(userId, recipe) {
  const uid = Number(userId);

  if (!uid || !recipe?.title) {
    const err = new Error("Missing userId or recipe.title");
    err.statusCode = 400;
    throw err;
  }

  const recipeId = await upsertAndSaveRecipeForUser({
    userId: uid,
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

  return { saved: true, recipe_id: recipeId };
}

export default {
  upsertAndSaveRecipeForUser,
  saveRecipeFromPayload,
};