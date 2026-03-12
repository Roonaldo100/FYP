export function normalizeExpiryDateInput(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;

  const s = String(v).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  return s;
}

export default {
  normalizeExpiryDateInput,
};