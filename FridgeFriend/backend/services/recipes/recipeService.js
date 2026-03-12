import pool from "../../db.js";
import { upsertAndSaveRecipeForUser } from "./savedRecipeService.js";

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

export async function assertUserSavedRecipe(userId, recipeId) {
  const r = await pool.query(
    `SELECT 1 FROM user_saved_recipes WHERE user_id = $1 AND recipe_id = $2 LIMIT 1`,
    [userId, recipeId],
  );
  if (!r.rows.length) {
    const err = new Error("Not saved by this user");
    err.statusCode = 403;
    throw err;
  }
}

export async function getRecipeMeta(recipeId) {
  const r = await pool.query(
    `SELECT id, source, created_by_user_id FROM recipes WHERE id = $1 LIMIT 1`,
    [recipeId],
  );
  return r.rows[0] || null;
}

export async function getRecipeWithIngredients(recipeId) {
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

export async function createRecipe(userId, { title, url, ingredients }) {
  const uid = Number(userId);

  if (!uid || !title || !String(title).trim()) {
    const err = new Error("Missing title");
    err.statusCode = 400;
    throw err;
  }

  const ing = cleanIngredientStrings(ingredients);
  if (!ing.length) {
    const err = new Error("Add at least one ingredient (min 3 chars)");
    err.statusCode = 400;
    throw err;
  }

  const recipeId = await upsertAndSaveRecipeForUser({
    userId: uid,
    title: String(title).trim(),
    source: "custom",
    externalId: null,
    url: url ? String(url) : null,
    ingredientsRaw: ing,
    nutritionJson: null,
  });

  return { created: true, recipe_id: recipeId };
}

export async function listRecipes(userId) {
  const uid = Number(userId);

  const r = await pool.query(
    `
    SELECT r.id, r.title, r.source, r.external_id, r.source_url, u.saved_at
    FROM user_saved_recipes u
    JOIN recipes r ON r.id = u.recipe_id
    WHERE u.user_id = $1
    ORDER BY u.saved_at DESC
    LIMIT 200
    `,
    [uid],
  );

  return r.rows.map((row) => ({
    id: Number(row.id),
    title: String(row.title),
    source: String(row.source),
    external_id: row.external_id ?? null,
    url: row.source_url ?? null,
    saved_at: row.saved_at,
  }));
}

export async function getRecipeDetails(userId, recipeId) {
  const uid = Number(userId);
  const rid = Number(recipeId);

  await assertUserSavedRecipe(uid, rid);

  const recipe = await getRecipeWithIngredients(rid);
  if (!recipe) {
    const err = new Error("Recipe not found");
    err.statusCode = 404;
    throw err;
  }

  return {
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
  };
}

export async function updateRecipe(userId, recipeId, { title, url, ingredients }) {
  const uid = Number(userId);
  const rid = Number(recipeId);

  const newTitle = String(title || "").trim();
  const newUrl = url ? String(url).trim() : null;
  const newIngredients = cleanIngredientStrings(ingredients);

  if (!uid || !rid) {
    const err = new Error("Invalid userId or recipeId");
    err.statusCode = 400;
    throw err;
  }
  if (!newTitle) {
    const err = new Error("Missing title");
    err.statusCode = 400;
    throw err;
  }
  if (!newIngredients.length) {
    const err = new Error("Add at least one ingredient (min 3 chars)");
    err.statusCode = 400;
    throw err;
  }

  await assertUserSavedRecipe(uid, rid);

  const meta = await getRecipeMeta(rid);
  if (!meta) {
    const err = new Error("Recipe not found");
    err.statusCode = 404;
    throw err;
  }

  if (meta.source !== "custom" || Number(meta.created_by_user_id) !== uid) {
    const err = new Error("Only custom recipes you created can be edited.");
    err.statusCode = 403;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE recipes SET title = $1, source_url = $2, igredients_json = $3 WHERE id = $4`,
      [newTitle, newUrl, JSON.stringify(newIngredients), rid],
    );

    await client.query("COMMIT");
    return { updated: true };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteRecipe(userId, recipeId) {
  const uid = Number(userId);
  const rid = Number(recipeId);

  if (!uid || !rid) {
    const err = new Error("Invalid userId or recipeId");
    err.statusCode = 400;
    throw err;
  }

  const delSaved = await pool.query(
    `DELETE FROM user_saved_recipes WHERE user_id = $1 AND recipe_id = $2`,
    [uid, rid],
  );

  if (delSaved.rowCount === 0) {
    const err = new Error("Recipe was not saved");
    err.statusCode = 404;
    throw err;
  }

  const meta = await getRecipeMeta(rid);
  if (!meta) return { removed: true, deleted_recipe: false };

  if (meta.source === "custom" && Number(meta.created_by_user_id) === uid) {
    const c = await pool.query(
      `SELECT COUNT(*)::int AS n FROM user_saved_recipes WHERE recipe_id = $1`,
      [rid],
    );
    const n = Number(c.rows[0]?.n ?? 0);

    if (n === 0) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM recipes WHERE id = $1`, [rid]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }

      return { removed: true, deleted_recipe: true };
    }
  }

  return { removed: true, deleted_recipe: false };
}

export default {
  assertUserSavedRecipe,
  getRecipeMeta,
  getRecipeWithIngredients,
  createRecipe,
  listRecipes,
  getRecipeDetails,
  updateRecipe,
  deleteRecipe,
};