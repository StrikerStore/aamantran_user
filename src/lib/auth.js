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
