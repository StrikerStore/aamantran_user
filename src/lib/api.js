import { getToken, clearToken } from './auth';
import { API_BASE } from './config';

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body   = body;
  }
}

async function request(method, path, { body, multipart = false, params } = {}) {
  const token = getToken();
  const url   = new URL(`${API_BASE}${path}`, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let fetchBody;
  if (multipart && body instanceof FormData) {
    fetchBody = body;
  } else if (body != null) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url.toString(), { method, headers, body: fetchBody });
  } catch {
    throw new ApiError('Network error — is the backend running?', 0, null);
  }

  if (res.status === 401) {
    clearToken();
    window.location.href = '/';
    return;
  }

  let json;
  try { json = await res.json(); }
  catch { throw new ApiError(`Non-JSON response (${res.status})`, res.status, null); }

  if (!res.ok) throw new ApiError(json?.message || `Request failed (${res.status})`, res.status, json);
  return json;
}

export const api = {
  auth: {
    login: (username, password, rememberMe = true) =>
      request('POST', '/api/user/auth/login', { body: { username, password, rememberMe } }),
    me: () =>
      request('GET', '/api/user/auth/me'),
    requestRecoveryCode: (email) =>
      request('POST', '/api/user/auth/recovery/request', { body: { email } }),
    verifyRecoveryCode: (email, code) =>
      request('POST', '/api/user/auth/recovery/verify', { body: { email, code } }),
    resetPasswordWithCode: (email, resetToken, newPassword) =>
      request('POST', '/api/user/auth/recovery/reset-password', { body: { email, resetToken, newPassword } }),
  },

  checkout: {
    lookupEmail: (email) =>
      request('GET', '/api/checkout/lookup-email', { params: { email } }),
    register: (body) =>
      request('POST', '/api/checkout/register', { body }),
  },

  events: {
    list:         ()             => request('GET',   '/api/user/events'),
    create:       (body)         => request('POST',  '/api/user/events', { body }),
    get:          (id)           => request('GET',   `/api/user/events/${id}`),
    previewToken: (id)           => request('GET',   `/api/user/events/${id}/preview-token`),
    update:       (id, body)     => request('PUT',   `/api/user/events/${id}`, { body }),
    confirmNames: (id)           => request('PATCH', `/api/user/events/${id}/confirm-names`),
    publish:        (id, body) => request('PATCH', `/api/user/events/${id}/publish`, { body }),
    updatePartial:  (id, body) => request('PATCH', `/api/user/events/${id}/partial-functions`, { body }),
    unpublish:      (id)       => request('PATCH', `/api/user/events/${id}/unpublish`),
    stats:        (id)           => request('GET',   `/api/user/events/${id}/stats`),
  },

  people: {
    list:   (eid)         => request('GET',    `/api/user/events/${eid}/people`),
    add:    (eid, body)   => request('POST',   `/api/user/events/${eid}/people`, { body }),
    update: (eid, pid, b) => request('PUT',    `/api/user/events/${eid}/people/${pid}`, { body: b }),
    remove: (eid, pid)    => request('DELETE', `/api/user/events/${eid}/people/${pid}`),
  },

  functions: {
    list:   (eid)           => request('GET',    `/api/user/events/${eid}/functions`),
    add:    (eid, body)     => request('POST',   `/api/user/events/${eid}/functions`, { body }),
    update: (eid, fnId, b)  => request('PUT',    `/api/user/events/${eid}/functions/${fnId}`, { body: b }),
    remove: (eid, fnId)     => request('DELETE', `/api/user/events/${eid}/functions/${fnId}`),
  },

  venues: {
    list:   (eid)          => request('GET',    `/api/user/events/${eid}/venues`),
    add:    (eid, body)    => request('POST',   `/api/user/events/${eid}/venues`, { body }),
    update: (eid, vId, b)  => request('PUT',    `/api/user/events/${eid}/venues/${vId}`, { body: b }),
    remove: (eid, vId)     => request('DELETE', `/api/user/events/${eid}/venues/${vId}`),
  },

  customFields: {
    get:    (eid)        => request('GET', `/api/user/events/${eid}/custom-fields`),
    upsert: (eid, body)  => request('PUT', `/api/user/events/${eid}/custom-fields`, { body }),
  },

  media: {
    list:   (eid)          => request('GET',    `/api/user/events/${eid}/media`),
    upload: (eid, body)    => request('POST',   `/api/user/events/${eid}/media`, {
      body,
      multipart: body instanceof FormData,
    }),
    remove: (eid, mid)     => request('DELETE', `/api/user/events/${eid}/media/${mid}`),
  },

  guests: {
    list:   (eid)  => request('GET', `/api/user/events/${eid}/guests`),
    export: (eid)  => `${API_BASE}/api/user/events/${eid}/guests/export`,
  },

  wishes: {
    list:       (eid)                => request('GET',    `/api/user/events/${eid}/wishes`),
    visibility: (eid, wishId, body)  => request('PATCH',  `/api/user/events/${eid}/wishes/${wishId}/visibility`, { body }),
    remove:     (eid, wishId)        => request('DELETE', `/api/user/events/${eid}/wishes/${wishId}`),
  },

  tickets: {
    list:   ()         => request('GET',  '/api/user/tickets'),
    create: (body)     => request('POST', '/api/user/tickets', { body }),
    get:    (id)       => request('GET',  `/api/user/tickets/${id}`),
  },

  profile: {
    update: (body) => request('PATCH', '/api/user/profile', { body }),
  },

  review: {
    submit: (body) => {
      const isFormData = body instanceof FormData;
      return request('POST', '/api/user/review', { body, multipart: isFormData });
    },
  },

  assets: {
    list: () => request('GET', '/api/assets'),
  },

  tasks: {
    list:   (eid)         => request('GET',    `/api/user/events/${eid}/tasks`),
    create: (eid, body)   => request('POST',   `/api/user/events/${eid}/tasks`, { body }),
    update: (eid, tid, b) => request('PATCH',  `/api/user/events/${eid}/tasks/${tid}`, { body: b }),
    remove: (eid, tid)    => request('DELETE', `/api/user/events/${eid}/tasks/${tid}`),
  },

  inventory: {
    list:   (eid)          => request('GET',    `/api/user/events/${eid}/inventory`),
    create: (eid, body)    => request('POST',   `/api/user/events/${eid}/inventory`, { body }),
    update: (eid, iid, b)  => request('PATCH',  `/api/user/events/${eid}/inventory/${iid}`, { body: b }),
    remove: (eid, iid)     => request('DELETE', `/api/user/events/${eid}/inventory/${iid}`),
  },

  budget: {
    get:           (eid)         => request('GET',    `/api/user/events/${eid}/budget`),
    setTotal:      (eid, body)   => request('PUT',    `/api/user/events/${eid}/budget`, { body }),
    listExpenses:  (eid)         => request('GET',    `/api/user/events/${eid}/budget/expenses`),
    addExpense:    (eid, body)   => request('POST',   `/api/user/events/${eid}/budget/expenses`, { body }),
    updateExpense: (eid, xid, b) => request('PATCH',  `/api/user/events/${eid}/budget/expenses/${xid}`, { body: b }),
    removeExpense: (eid, xid)    => request('DELETE', `/api/user/events/${eid}/budget/expenses/${xid}`),
  },

  vendors: {
    list:   (eid)          => request('GET',    `/api/user/events/${eid}/vendors`),
    create: (eid, body)    => request('POST',   `/api/user/events/${eid}/vendors`, { body }),
    update: (eid, vid, b)  => request('PATCH',  `/api/user/events/${eid}/vendors/${vid}`, { body: b }),
    remove: (eid, vid)     => request('DELETE', `/api/user/events/${eid}/vendors/${vid}`),
  },

  timeline: {
    list:   (eid)          => request('GET',    `/api/user/events/${eid}/timeline`),
    create: (eid, body)    => request('POST',   `/api/user/events/${eid}/timeline`, { body }),
    update: (eid, tid, b)  => request('PATCH',  `/api/user/events/${eid}/timeline/${tid}`, { body: b }),
    remove: (eid, tid)     => request('DELETE', `/api/user/events/${eid}/timeline/${tid}`),
  },

  moodboard: {
    list:   (eid)         => request('GET',    `/api/user/events/${eid}/moodboard`),
    create: (eid, body)   => request('POST',   `/api/user/events/${eid}/moodboard`, { body, multipart: body instanceof FormData }),
    remove: (eid, mid)    => request('DELETE', `/api/user/events/${eid}/moodboard/${mid}`),
  },

  gifts: {
    list:   (eid)          => request('GET',    `/api/user/events/${eid}/gifts`),
    create: (eid, body)    => request('POST',   `/api/user/events/${eid}/gifts`, { body }),
    update: (eid, gid, b)  => request('PATCH',  `/api/user/events/${eid}/gifts/${gid}`, { body: b }),
    remove: (eid, gid)     => request('DELETE', `/api/user/events/${eid}/gifts/${gid}`),
  },

  photos: {
    list:   (eid)         => request('GET',    `/api/user/events/${eid}/photos`),
    upload: (eid, body)   => request('POST',   `/api/user/events/${eid}/photos`, { body, multipart: body instanceof FormData }),
    remove: (eid, pid)    => request('DELETE', `/api/user/events/${eid}/photos/${pid}`),
  },
};

export { ApiError };
