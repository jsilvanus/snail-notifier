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

  // Memberships
  getMemberships: (token) => request('/memberships', {}, token),
  updateMembership: (id, body, token) => request(`/memberships/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),
  deleteMembership: (id, token) => request(`/memberships/${id}`, { method: 'DELETE' }, token),
  getMembershipChannels: (id, token) => request(`/memberships/${id}/channels`, {}, token),
  setMembershipChannels: (id, channels, token) => request(`/memberships/${id}/channels`, { method: 'PUT', body: JSON.stringify({ channels }) }, token),

  // User channel contact info
  getUserChannels: (token) => request('/users/me/channels', {}, token),
  setUserChannel: (channel, value, token) => request('/users/me/channels', { method: 'PUT', body: JSON.stringify({ channel, value }) }, token),
};
