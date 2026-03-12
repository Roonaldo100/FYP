export function parseOptionalStoreId(raw) {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) raw = raw[0];

  const s = String(raw).trim();
  if (!s) return null;

  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    const err = new Error("Invalid storeId");
    err.statusCode = 400;
    throw err;
  }

  return n;
}

export function normalizeProductName(name) {
  const s = String(name || "").trim();
  if (!s) return null;
  return s.slice(0, 30);
}

export default {
  parseOptionalStoreId,
  normalizeProductName,
};