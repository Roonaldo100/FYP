export const MAX_SHOPPING_LIST_NAME_LENGTH = 40;

export function cleanListName(name) {
  const s = String(name || "").trim();
  if (!s) return null;

  if (s.length > MAX_SHOPPING_LIST_NAME_LENGTH) {
    const err = new Error(
      `Shopping list name must be ${MAX_SHOPPING_LIST_NAME_LENGTH} characters or fewer`
    );
    err.statusCode = 400;
    throw err;
  }

  return s;
}

export function cleanCustomItemName(name) {
  const s = String(name || "").trim();
  if (!s) return null;
  if (s.length > 80) return s.slice(0, 80);
  return s;
}

export default {
  cleanListName,
  cleanCustomItemName,
};