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
  // Auth
  registerOrg: (body) => request('/auth/org/register', { method: 'POST', body: JSON.stringify(body) }),
  loginOrg: (body) => request('/auth/org/login', { method: 'POST', body: JSON.stringify(body) }),

  // Codes
  listCodes: (token) => request('/codes', {}, token),
  createCode: (body, token) => request('/codes', { method: 'POST', body: JSON.stringify(body) }, token),
  deleteCode: (id, token) => request(`/codes/${id}`, { method: 'DELETE' }, token),

  // Users
  listUsers: (token) => request('/users', {}, token),
  createUser: (body, token) => request('/users', { method: 'POST', body: JSON.stringify(body) }, token),
  deleteUser: (id, token) => request(`/users/${id}`, { method: 'DELETE' }, token),
};
