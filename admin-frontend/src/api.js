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
  registerOrg: (body) => request('/auth/org/register', { method: 'POST', body: JSON.stringify(body) }),
  loginOrg: (body) => request('/auth/org/login', { method: 'POST', body: JSON.stringify(body) }),

  listCodes: (token) => request('/codes', {}, token),
  createCode: (body, token) => request('/codes', { method: 'POST', body: JSON.stringify(body) }, token),
  updateCode: (id, body, token) => request(`/codes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),
  deleteCode: (id, token) => request(`/codes/${id}`, { method: 'DELETE' }, token),

  listMembers: (codeId, token) => request(`/codes/${codeId}/members`, {}, token),
  inviteMember: (codeId, email, token) => request(`/tokens/${codeId}/invite`, { method: 'POST', body: JSON.stringify({ email }) }, token),

  listFields: (codeId, token) => request(`/codes/${codeId}/fields`, {}, token),
  createField: (codeId, body, token) => request(`/codes/${codeId}/fields`, { method: 'POST', body: JSON.stringify(body) }, token),
  deleteField: (codeId, fieldId, token) => request(`/codes/${codeId}/fields/${fieldId}`, { method: 'DELETE' }, token),

  listMessages: (codeId, token) => request(`/codes/${codeId}/messages`, {}, token),
  setMessage: (codeId, channel, message_template, token) => request(`/codes/${codeId}/messages`, { method: 'PUT', body: JSON.stringify({ channel, message_template }) }, token),
  deleteMessage: (codeId, channel, token) => request(`/codes/${codeId}/messages/${channel}`, { method: 'DELETE' }, token),

  listUsers: (token) => request('/users', {}, token),
  createUser: (body, token) => request('/users', { method: 'POST', body: JSON.stringify(body) }, token),
  deleteUser: (id, token) => request(`/users/${id}`, { method: 'DELETE' }, token),
};
