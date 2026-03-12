export function cleanIngredientStrings(value) {
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

export function normalizeIngredientsJsonbInput(value) {
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

export function normalizeJsonbInput(value) {
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

export function toIngredientObjects(ingredientsArray) {
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

export default {
  cleanIngredientStrings,
  normalizeIngredientsJsonbInput,
  normalizeJsonbInput,
  toIngredientObjects,
};