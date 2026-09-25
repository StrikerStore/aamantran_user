/**
 * Ceremony start times are stored as display text ("7:00 PM") because
 * templates print them as-is. The builder edits them with a real time picker,
 * which speaks 24-hour "19:00".
 */

/** "7:00 PM" / "7 pm" / "19:00" → "19:00"; '' when it can't be read. */
export function toTimeInput(text) {
  const s = String(text || '').trim().toLowerCase();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return '';
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const mer = m[3] ? m[3][0] : null;
  if (min > 59 || h > 23) return '';
  if (mer === 'p' && h < 12) h += 12;
  if (mer === 'a' && h === 12) h = 0;
  if (!mer && h > 23) return '';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** "19:00" → "7:00 PM" */
export function fromTimeInput(value) {
  const m = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!m) return '';
  let h = Number(m[1]);
  const mer = h >= 12 ? 'PM' : 'AM';
  h %= 12;
  if (h === 0) h = 12;
  return `${h}:${m[2]} ${mer}`;
}
