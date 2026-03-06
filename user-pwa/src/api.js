const BASE = '/api';

async function request(path, options = {}, token = null) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  registerUser: (body) => request('/auth/user/register', { method: 'POST', body: JSON.stringify(body) }),
  loginUser: (body) => request('/auth/user/login', { method: 'POST', body: JSON.stringify(body) }),
  getVapidKey: () => request('/notifications/vapid-key'),
  subscribe: (subscription, token) => request('/notifications/subscribe', { method: 'POST', body: JSON.stringify({ subscription }) }, token),
  unsubscribe: (token) => request('/notifications/subscribe', { method: 'DELETE' }, token),
  getNotifications: (token) => request('/notifications', {}, token),
};
