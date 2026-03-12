export function cleanListName(name) {
  const s = String(name || "").trim();
  if (!s) return null;
  if (s.length > 80) return s.slice(0, 80);
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