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

export function isValidYMD(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function normalizeTwoDigitYear(year: number): number {
  if (!Number.isInteger(year)) return year;
  if (year < 100) return 2000 + year;
  return year;
}

export function monthNameToNumber(raw: string): number | null {
  const key = String(raw || "").trim().toUpperCase();

  const months: Record<string, number> = {
    JAN: 1,
    JANUARY: 1,
    FEB: 2,
    FEBRUARY: 2,
    MAR: 3,
    MARCH: 3,
    APR: 4,
    APRIL: 4,
    MAY: 5,
    JUN: 6,
    JUNE: 6,
    JUL: 7,
    JULY: 7,
    AUG: 8,
    AUGUST: 8,
    SEP: 9,
    SEPT: 9,
    SEPTEMBER: 9,
    OCT: 10,
    OCTOBER: 10,
    NOV: 11,
    NOVEMBER: 11,
    DEC: 12,
    DECEMBER: 12,
  };

  return months[key] ?? null;
}

export function parseCompactExpiryCandidate(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const yyyy = Number(digits.slice(0, 4));
  const mmA = Number(digits.slice(4, 6));
  const ddA = Number(digits.slice(6, 8));

  const asYMD = isValidYMD(yyyy, mmA, ddA)
    ? toIsoDate(yyyy, mmA, ddA)
    : null;

  const ddB = Number(digits.slice(0, 2));
  const mmB = Number(digits.slice(2, 4));
  const yyyyB = Number(digits.slice(4, 8));

  const asDMY = isValidYMD(yyyyB, mmB, ddB)
    ? toIsoDate(yyyyB, mmB, ddB)
    : null;

  if (asYMD && !asDMY) return asYMD;
  if (!asYMD && asDMY) return asDMY;
  if (asYMD && asDMY) return asYMD;

  return null;
}

export function parseSeparatedNumericDate(raw: string): string | null {
  const match = String(raw || "").match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})\b/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = normalizeTwoDigitYear(Number(match[3]));

  if (!isValidYMD(year, month, day)) return null;
  return toIsoDate(year, month, day);
}

export function parseMonthNameDate(raw: string): string | null {
  const text = String(raw || "");

  const patterns = [
    /\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2}|\d{4})\b/,
    /\b(\d{1,2})[\/.\-\s]+([A-Za-z]{3,9})[\/.\-\s]+(\d{2}|\d{4})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const day = Number(match[1]);
    const month = monthNameToNumber(match[2]);
    const year = normalizeTwoDigitYear(Number(match[3]));

    if (month === null) continue;
    if (!isValidYMD(year, month, day)) continue;

    return toIsoDate(year, month, day);
  }

  return null;
}

export function extractExpiryDateFromText(rawText: string): string | null {
  const text = String(rawText || "");
  if (!text.trim()) return null;

  const monthNameParsed = parseMonthNameDate(text);
  if (monthNameParsed) return monthNameParsed;

  const separatedNumericParsed = parseSeparatedNumericDate(text);
  if (separatedNumericParsed) return separatedNumericParsed;

  const exact8 = text.match(/\b\d{8}\b/g) ?? [];
  for (const candidate of exact8) {
    const parsed = parseCompactExpiryCandidate(candidate);
    if (parsed) return parsed;
  }

  const loose = text.match(/\d[\d\s./-]{6,16}\d/g) ?? [];
  for (const chunk of loose) {
    const digits = chunk.replace(/\D/g, "");
    if (digits.length !== 8) continue;

    const parsed = parseCompactExpiryCandidate(digits);
    if (parsed) return parsed;
  }

  return null;
}

export function normalizeExpiryInput(raw: string): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return isValidYMD(year, month, day) ? trimmed : null;
  }

  return (
    parseMonthNameDate(trimmed) ||
    parseSeparatedNumericDate(trimmed) ||
    parseCompactExpiryCandidate(trimmed)
  );
}