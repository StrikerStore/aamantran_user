/**
 * Same rules as backend dateNormalize (keep in sync for UX).
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ymd(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function parseFlexibleDateInputToYyyyMmDd(input) {
  if (input == null || input === '') return '';
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return ymd(input.getFullYear(), input.getMonth() + 1, input.getDate());
  }
  const s0 = String(input).trim();
  if (!s0) return '';

  let m = s0.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = s0.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})/);
  if (m) return ymd(m[1], parseInt(m[2], 10), parseInt(m[3], 10));

  m = s0.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    if (a > 12 && b <= 12) return ymd(y, b, a);
    if (b > 12 && a <= 12) return ymd(y, a, b);
    return ymd(y, b, a);
  }

  const d = new Date(s0);
  if (!Number.isNaN(d.getTime())) return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return '';
}

export function toHtmlDateInputValue(stored) {
  return parseFlexibleDateInputToYyyyMmDd(stored);
}
