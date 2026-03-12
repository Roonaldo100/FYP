import pool from "../../db.js";

const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;
const SPOON_BASE = "https://api.spoonacular.com";

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

function scoreTitleForDish(dish, title) {
  const dishNorm = normalizeText(dish);
  const titleNorm = normalizeText(title);

  if (!dishNorm || !titleNorm) return -Infinity;
  if (titleNorm === dishNorm) return 1000000;

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

export async function generateRecipe({ userId, message }) {
  if (!userId || !message || !String(message).trim()) {
    return {
      reply: "Missing userId or message.",
      recipes: [],
      statusCode: 400,
    };
  }

  const dish = extractRequestedDish(message);
  if (!dish) {
    return {
      reply:
        "Tell me a specific dish you want to make (e.g. “apple pie”), and I’ll compare the ingredients to your inventory.",
      recipes: [],
      statusCode: 200,
    };
  }

  const { expiringSoon, pantry } = await getUserInventorySummary(userId);
  const inventoryItems = [...expiringSoon, ...pantry];

  if (inventoryItems.length === 0) {
    return {
      reply:
        "Your inventory looks empty. Add a few items first, then I can compare ingredients against what you have.",
      recipes: [],
      statusCode: 200,
    };
  }

  const hit = await spoonSearchRecipeByDish(dish);
  if (!hit) {
    return {
      reply: `I couldn't find a Spoonacular recipe for "${dish}". Try a slightly different wording (e.g. “apple tart”).`,
      recipes: [],
      statusCode: 200,
    };
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

  return {
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
    statusCode: 200,
  };
}

export default {
  generateRecipe,
  normalizeText,
  toBaseWord,
  tokenize,
  ingredientMatchesInventory,
  extractRequestedDish,
  getUserInventorySummary,
  spoonFetchJson,
  spoonAutocompleteRecipe,
  scoreTitleForDish,
  pickBestRecipeHit,
  dedupeById,
  spoonSearchRecipeByDish,
  spoonGetRecipeInformation,
};