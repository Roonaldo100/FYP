export function toPositiveInt(v, fallback = null) {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

export default {
  toPositiveInt,
};