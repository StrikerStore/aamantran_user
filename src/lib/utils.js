export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "2026-01-15" → "15 Jan" (adds the year when it isn't this year). */
export function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatRelative(d) {
  if (!d) return '—';
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 60)     return 'just now';
  const ago = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  if (sec < 3600)   return ago(Math.floor(sec / 60), 'min');
  if (sec < 86400)  return ago(Math.floor(sec / 3600), 'hour');
  if (sec < 604800) return ago(Math.floor(sec / 86400), 'day');
  return formatDate(d);
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function debounce(fn, delay = 320) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

export async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

/** Countdown to a date — returns { days, hours, minutes, past } */
export function countdown(date) {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, past: true };
  const days    = Math.floor(diff / 86400000);
  const hours   = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return { days, hours, minutes, past: false };
}

export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build a WhatsApp share link.
 *
 * Deliberately NOT wa.me: that shortlink 302s to api.whatsapp.com and replaces
 * every non-ASCII character with U+FFFD on the way, so emoji in the message
 * arrive as "�". Sending %F0%9F%8E%89 (🎉) comes back as %EF%BF%BD. Linking to
 * the redirect target directly leaves the text untouched.
 */
export function whatsappShareUrl(text) {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/** Extract lat/lng from a Google Maps URL */
export function parseGoogleMapsUrl(url) {
  if (!url) return null;
  // @lat,lng or place/lat,lng
  const match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/) ||
                url.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  return null;
}
