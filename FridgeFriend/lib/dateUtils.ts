export function normalizeExpiryDisplay(value: string | null | undefined): string | null {
  if (!value) return null;

  const s = String(value).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  return s;
}

export function formatDisplayDate(value: string | null | undefined): string {
  const normalized = normalizeExpiryDisplay(value);
  if (!normalized) return "None";

  const parts = normalized.split("-");
  if (parts.length !== 3) return normalized;

  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}