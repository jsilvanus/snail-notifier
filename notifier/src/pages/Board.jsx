import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = '/api';
const STORAGE_KEY = 'snail_notifier_board';

// Each entry: { id, scanToken, label, title, behavior, color, page }
// Colors for token buttons
const COLORS = ['#dbeafe', '#dcfce7', '#fef9c3', '#fce7f3', '#f3e8ff', '#ffedd5', '#e0f2fe', '#d1fae5'];

function loadBoard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { tokens: [], pageCount: 1, currentPage: 0 };
  } catch { return { tokens: [], pageCount: 1, currentPage: 0 }; }
}

function saveBoard(board) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
}

function FormModal({ info, onClose, onDone }) {
  const [responses, setResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/scan/${info.scanToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });
      const data = await res.json();
      onDone(res.ok ? 'Notification sent!' : (data.error || 'Error'));
    } catch { onDone('Network error'); }
    setSubmitting(false);
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <h3 style={{ marginBottom: '.25rem' }}>{info.title || info.tokenName}</h3>
        {info.description && <p style={{ color: 'var(--muted)', fontSize: '.875rem', marginBottom: '1rem' }}>{info.description}</p>}
        <form onSubmit={handleSubmit}>
          {info.fields.map(f => (
            <div className="form-group" key={f.id}>
              <label>{f.label}{f.required ? ' *' : ''}</label>
              <input
                type={f.field_type === 'number' ? 'number' : 'text'}
                placeholder={f.placeholder || ''}
                required={!!f.required}
                value={responses[f.id] || ''}
                onChange={e => setResponses(r => ({ ...r, [f.id]: e.target.value }))}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ flex: 1 }}>
              {submitting ? 'Sending…' : 'Send Notification'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Board() {
  const navigate = useNavigate();
  const [board, setBoard] = useState(loadBoard);
  const [formInfo, setFormInfo] = useState(null);
  const [toast, setToast] = useState('');
  const [dragging, setDragging] = useState(null); // { tokenId }
  const [dragOver, setDragOver] = useState(null);
  const touchStartX = useRef(null);
  const toastTimer = useRef(null);

  const { tokens, pageCount, currentPage } = board;

  function update(patch) {
    setBoard(b => {
      const next = { ...b, ...patch };
      saveBoard(next);
      return next;
    });
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  }

  async function handleTrigger(tk) {
    try {
      const res = await fetch(`${API_BASE}/scan/${tk.scanToken}`);
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Error'); return; }
      if (data.behavior === 'data_input') {
        setFormInfo({ scanToken: tk.scanToken, title: tk.title || tk.label, description: data.description, tokenName: data.tokenName, fields: data.fields });
      } else {
        showToast('Notification sent!');
      }
    } catch { showToast('Network error'); }
  }

  function handleFormDone(msg) {
    setFormInfo(null);
    showToast(msg);
  }

  function removeToken(id) {
    update({ tokens: tokens.filter(t => t.id !== id) });
  }

  function addPage() {
    update({ pageCount: pageCount + 1, currentPage: pageCount });
  }

  function removePage() {
    if (pageCount <= 1) return;
    const newPage = Math.min(currentPage, pageCount - 2);
    update({
      tokens: tokens.filter(t => t.page !== currentPage).map(t => ({ ...t, page: t.page > currentPage ? t.page - 1 : t.page })),
      pageCount: pageCount - 1,
      currentPage: newPage,
    });
  }

  // Swipe to change page
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) {
      if (dx < 0 && currentPage < pageCount - 1) update({ currentPage: currentPage + 1 });
      if (dx > 0 && currentPage > 0) update({ currentPage: currentPage - 1 });
    }
    touchStartX.current = null;
  }

  // Drag and drop (HTML5)
  function onDragStart(tokenId) { setDragging(tokenId); }
  function onDragEnd() { setDragging(null); setDragOver(null); }
  function onDrop(targetId) {
    if (!dragging || dragging === targetId) return;
    const src = tokens.findIndex(t => t.id === dragging);
    const dst = tokens.findIndex(t => t.id === targetId);
    if (src === -1 || dst === -1) return;
    const next = [...tokens];
    const [item] = next.splice(src, 1);
    next.splice(dst, 0, item);
    update({ tokens: next });
  }

  const pageTokens = tokens.filter(t => t.page === currentPage);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header>
        <span className="brand">📬 Notifier</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', fontSize: '.8rem', color: 'var(--muted)' }}>
          <span>Page {currentPage + 1}/{pageCount}</span>
          <button className="btn btn-ghost" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }} onClick={addPage}>+ Page</button>
          {pageCount > 1 && (
            <button className="btn btn-danger" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }} onClick={removePage}>− Page</button>
          )}
        </div>
      </header>

      {/* Button board */}
      <div className="board-wrap" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="pages-track" style={{ transform: `translateX(-${currentPage * 100}%)` }}>
          {Array.from({ length: pageCount }, (_, p) => (
            <div key={p} className="page-panel">
              {tokens.filter(t => t.page === p).map(tk => (
                <div
                  key={tk.id}
                  className={`token-btn${dragging === tk.id ? ' dragging' : ''}${dragOver === tk.id ? ' drag-over' : ''}`}
                  style={{ background: tk.color || '#f1f5f9' }}
                  draggable
                  onDragStart={() => onDragStart(tk.id)}
                  onDragEnd={onDragEnd}
                  onDragOver={e => { e.preventDefault(); setDragOver(tk.id); }}
                  onDrop={() => onDrop(tk.id)}
                  onClick={() => handleTrigger(tk)}
                >
                  <button className="remove-btn" onClick={e => { e.stopPropagation(); removeToken(tk.id); }}>✕</button>
                  <span className="icon">{tk.behavior === 'data_input' ? '📝' : '📬'}</span>
                  <span className="label">{tk.title || tk.label}</span>
                  {tk.label !== tk.title && tk.label && <span className="sub">{tk.label}</span>}
                </div>
              ))}
              {/* Add button — only on current page */}
              {p === currentPage && (
                <div className="token-btn add-btn" onClick={() => navigate(`/add?page=${p}`)}>+</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Page dots */}
      <div className="page-dots">
        {Array.from({ length: pageCount }, (_, i) => (
          <button key={i} className={`page-dot${i === currentPage ? ' active' : ''}`} onClick={() => update({ currentPage: i })} />
        ))}
      </div>

      {/* Form modal */}
      {formInfo && <FormModal info={formInfo} onClose={() => setFormInfo(null)} onDone={handleFormDone} />}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
