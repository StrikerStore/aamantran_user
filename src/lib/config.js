const PROD_API = 'https://api.aamantran.online';

/** API base URL — set VITE_API_URL in .env; production fallback uses api subdomain */
export const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? PROD_API : '');

/** Public invite base URL — where guest invitations are served */
export function getInviteBaseUrl() {
  const v = import.meta.env.VITE_PUBLIC_INVITE_BASE_URL;
  if (v && String(v).trim()) return String(v).replace(/\/$/, '');
  return import.meta.env.PROD ? PROD_API : 'http://localhost:4000';
}
