import { API_BASE } from './config';

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
 * In-flight handoff verification. App must wait on this before reading
 * isAuthenticated(), or RequireAuth/RequireGuest will race the network check.
 */
let sessionHandoffPromise = null;

export function getSessionHandoffPromise() {
  return sessionHandoffPromise;
}

function stripLocationHash() {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

function readHandoffTokenFromHash() {
  const hash = window.location.hash || '';
  const match = hash.match(/(?:^#|&)session=([^&]+)/);
  if (!match) return null;

  let token = null;
  try {
    token = decodeURIComponent(match[1]);
  } catch {
    token = null;
  }
  stripLocationHash();
  return token;
}

function isHandoffCandidate(token) {
  if (typeof token !== 'string' || !token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return false;
  const payload = decodeJWT(token);
  return Boolean(payload && !isExpired(token) && payload.role === 'user');
}

/**
 * Ask the API whether this JWT is a real signed user session.
 * Must not go through `api.request()` — that helper calls clearToken() on 401
 * and would destroy a legitimate remember-me session while rejecting a forged
 * handoff token.
 */
async function verifyUserToken(token) {
  try {
    const res = await fetch(`${API_BASE}/api/user/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function adoptVerifiedHandoff(token) {
  if (!(await verifyUserToken(token))) return false;
  saveToken(token, false); // sessionStorage — ends with the tab
  return true;
}

/**
 * Adopt a session handed over in the URL fragment (`#session=<jwt>`), used by
 * the admin Testing page to open this app already signed in as the master
 * testing account.
 *
 * The fragment is used rather than a query string because it is never sent to
 * the server and never appears in a Referer header. It is stripped from the URL
 * immediately. The token is stored in sessionStorage only after `/auth/me`
 * accepts it, so a forged or unsigned JWT cannot wipe a remember-me session.
 *
 * Call before React renders, then wait on `getSessionHandoffPromise()` before
 * routing so RequireAuth does not redirect during verification.
 */
export function consumeSessionHandoff() {
  const token = readHandoffTokenFromHash();
  if (!isHandoffCandidate(token)) {
    sessionHandoffPromise = null;
    return false;
  }

  sessionHandoffPromise = adoptVerifiedHandoff(token);
  return true;
}
