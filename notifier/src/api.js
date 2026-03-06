const BASE = '/api';

async function req(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Layouts
  createLayout: (name) => req('/layouts', { method: 'POST', body: JSON.stringify({ name }) }),
  getLayout: (shareCode) => req(`/layouts/${shareCode}`),
  renameLayout: (shareCode, name) => req(`/layouts/${shareCode}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteLayout: (shareCode) => req(`/layouts/${shareCode}`, { method: 'DELETE' }),

  // Buttons
  addTokenButton: (shareCode, body) => req(`/layouts/${shareCode}/buttons`, { method: 'POST', body: JSON.stringify({ button_type: 'token', ...body }) }),
  addLayoutButton: (shareCode, body) => req(`/layouts/${shareCode}/buttons`, { method: 'POST', body: JSON.stringify({ button_type: 'layout', ...body }) }),
  updateButton: (shareCode, id, body) => req(`/layouts/${shareCode}/buttons/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  removeButton: (shareCode, id) => req(`/layouts/${shareCode}/buttons/${id}`, { method: 'DELETE' }),
  reorderButtons: (shareCode, order) => req(`/layouts/${shareCode}/buttons/order`, { method: 'PUT', body: JSON.stringify({ order }) }),

  // Token info (for resolving QR scans)
  getTokenInfo: (scanToken) => req(`/scan/${scanToken}/info`),
  triggerScan: (scanToken) => req(`/scan/${scanToken}`),
  submitForm: (scanToken, responses) => req(`/scan/${scanToken}`, { method: 'POST', body: JSON.stringify({ responses }) }),
};

// ── Local state: which layouts this device has saved ──────────────────────────

const LS_KEY = 'snail_notifier_state';

export function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : { layouts: [], home: null };
  } catch { return { layouts: [], home: null }; }
}

export function saveState(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

export function addSavedLayout(shareCode, name) {
  const state = loadState();
  if (!state.layouts.find(l => l.shareCode === shareCode)) {
    state.layouts.push({ shareCode, name });
    if (!state.home) state.home = shareCode;
    saveState(state);
  }
  return state;
}

export function removeSavedLayout(shareCode) {
  const state = loadState();
  state.layouts = state.layouts.filter(l => l.shareCode !== shareCode);
  if (state.home === shareCode) state.home = state.layouts[0]?.shareCode || null;
  saveState(state);
  return state;
}

export function setHomeLayout(shareCode) {
  const state = loadState();
  state.home = shareCode;
  saveState(state);
  return state;
}

export function updateSavedName(shareCode, name) {
  const state = loadState();
  const layout = state.layouts.find(l => l.shareCode === shareCode);
  if (layout) layout.name = name;
  saveState(state);
  return state;
}
