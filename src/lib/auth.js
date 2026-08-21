const TOKEN_KEY = 'aam_user_token';
const SESSION_KEY = 'aam_user_session_token';

function decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

function isExpired(token) {
  const p = decodeJWT(token);
  return !p || !p.exp || Date.now() >= p.exp * 1000;
}

export function saveToken(token, remember = true) {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(SESSION_KEY);
}

export function isAuthenticated() {
  const t = getToken();
  return !!t && !isExpired(t);
}

/** True if a stale/expired token exists — used to show "session expired" message on login */
export function hadSession() {
  const t = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(SESSION_KEY);
  return !!t && isExpired(t);
}

export function getUserInfo() {
  const t = getToken();
  return t ? decodeJWT(t) : null;
}

/**
 * Adopt a session handed over in the URL fragment (`#session=<jwt>`), used by
 * the admin Testing page to open this app already signed in as the master
 * testing account.
 *
 * The fragment is used rather than a query string because it is never sent to
 * the server and never appears in a Referer header. It is stripped from the URL
 * immediately, and stored in sessionStorage so it dies with the tab.
 *
 * Only accepts an unexpired token; anything else is discarded silently.
 * Must run before React renders, or RequireAuth will redirect first.
 */
export function consumeSessionHandoff() {
  const hash = window.location.hash || '';
  const match = hash.match(/(?:^#|&)session=([^&]+)/);
  if (!match) return false;

  const token = decodeURIComponent(match[1]);
  history.replaceState(null, '', window.location.pathname + window.location.search);

  const payload = decodeJWT(token);
  if (!payload || isExpired(token) || payload.role !== 'user') return false;

  saveToken(token, false); // sessionStorage — ends with the tab
  return true;
}
