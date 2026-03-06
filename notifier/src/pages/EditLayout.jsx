import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, updateSavedName } from '../api.js';

const COLORS = ['#dbeafe', '#dcfce7', '#fef9c3', '#fce7f3', '#f3e8ff', '#ffedd5', '#e0f2fe', '#d1fae5'];

export default function EditLayout() {
  const { shareCode } = useParams();
  const navigate = useNavigate();

  const [layout, setLayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  // Add layout button inline form
  const [addingLayout, setAddingLayout] = useState(false);
  const [layoutCode, setLayoutCode] = useState('');
  const [layoutLabel, setLayoutLabel] = useState('');
  const [layoutColor, setLayoutColor] = useState(COLORS[4]); // purple default for layout buttons
  const [layoutErr, setLayoutErr] = useState('');

  // Drag state for reordering
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getLayout(shareCode);
      setLayout(data);
      setName(data.name);
    } catch {
      setError('Could not load layout.');
    } finally {
      setLoading(false);
    }
  }, [shareCode]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  }

  async function handleRename(e) {
    e.preventDefault();
    if (!name.trim() || name.trim() === layout.name) { setRenaming(false); return; }
    setSaving(true);
    try {
      await api.renameLayout(shareCode, name.trim());
      updateSavedName(shareCode, name.trim());
      setLayout(l => ({ ...l, name: name.trim() }));
      setRenaming(false);
      showToast('Renamed');
    } catch (err) {
      showToast('Failed to rename');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveButton(id) {
    try {
      await api.removeButton(shareCode, id);
      setLayout(l => ({ ...l, buttons: l.buttons.filter(b => b.id !== id) }));
    } catch {
      showToast('Failed to remove button');
    }
  }

  // Drag and drop for reorder
  function onDragStart(id) { setDragging(id); }
  function onDragEnd() { setDragging(null); setDragOver(null); }

  async function onDrop(targetId) {
    if (!dragging || dragging === targetId) return;
    const btns = layout.buttons;
    const src = btns.findIndex(b => b.id === dragging);
    const dst = btns.findIndex(b => b.id === targetId);
    if (src === -1 || dst === -1) return;
    const next = [...btns];
    const [item] = next.splice(src, 1);
    next.splice(dst, 0, item);
    setLayout(l => ({ ...l, buttons: next }));
    setDragging(null);
    setDragOver(null);
    try {
      await api.reorderButtons(shareCode, next.map(b => b.id));
    } catch {
      showToast('Reorder failed — reload to sync');
    }
  }

  async function handleAddLayoutButton(e) {
    e.preventDefault();
    const code = layoutCode.trim().toUpperCase();
    setLayoutErr('');
    setSaving(true);
    try {
      const btn = await api.addLayoutButton(shareCode, {
        target_share_code: code,
        label: layoutLabel.trim() || undefined,
        color: layoutColor,
      });
      // Fetch updated layout to get target_name resolved
      const refreshed = await api.getLayout(shareCode);
      setLayout(refreshed);
      setAddingLayout(false);
      setLayoutCode('');
      setLayoutLabel('');
      setLayoutColor(COLORS[4]);
      showToast('Layout button added');
    } catch (err) {
      setLayoutErr(err.message || 'Failed to add layout button');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLayout() {
    if (!confirm(`Delete layout "${layout.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteLayout(shareCode);
      navigate('/');
    } catch {
      showToast('Failed to delete layout');
    }
  }

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <header>
          <button className="btn btn-ghost" style={{ fontSize: '.85rem', padding: '.35rem .75rem' }} onClick={() => navigate(`/board/${shareCode}`)}>← Back</button>
          <span className="brand" style={{ flex: 1, textAlign: 'center' }}>Edit Layout</span>
          <span style={{ width: 80 }} />
        </header>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <header>
          <button className="btn btn-ghost" style={{ fontSize: '.85rem', padding: '.35rem .75rem' }} onClick={() => navigate('/')}>← Back</button>
          <span className="brand" style={{ flex: 1 }}>Edit Layout</span>
        </header>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#dc2626' }}>{error}</p>
        </div>
      </div>
    );
  }

  const buttons = layout?.buttons || [];

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header>
        <button className="btn btn-ghost" style={{ fontSize: '.85rem', padding: '.35rem .75rem' }} onClick={() => navigate(`/board/${shareCode}`)}>← Back</button>
        <span className="brand" style={{ flex: 1, textAlign: 'center' }}>Edit Layout</span>
        <span style={{ width: 80 }} />
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 520, margin: '0 auto', width: '100%' }}>

        {/* Rename */}
        <div className="card">
          <h4 style={{ fontSize: '.875rem', color: 'var(--muted)', marginBottom: '.75rem' }}>Layout name</h4>
          {renaming ? (
            <form onSubmit={handleRename} style={{ display: 'flex', gap: '.5rem' }}>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} required />
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? '…' : 'Save'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setRenaming(false); setName(layout.name); }}>Cancel</button>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
              <span style={{ fontWeight: 700, flex: 1 }}>{layout.name}</span>
              <button className="btn btn-ghost" style={{ fontSize: '.8rem', padding: '.3rem .7rem' }} onClick={() => setRenaming(true)}>Rename</button>
            </div>
          )}
          <div style={{ fontSize: '.75rem', color: 'var(--muted)', fontFamily: 'monospace', marginTop: '.5rem' }}>
            Share code: <strong>{shareCode}</strong>
          </div>
        </div>

        {/* Buttons list */}
        <div className="card">
          <h4 style={{ fontSize: '.875rem', color: 'var(--muted)', marginBottom: '.75rem' }}>
            Buttons ({buttons.length})
          </h4>

          {buttons.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '.875rem', textAlign: 'center', padding: '.75rem 0' }}>No buttons yet.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {buttons.map(btn => (
              <div
                key={btn.id}
                className={dragging === btn.id ? 'dragging' : dragOver === btn.id ? 'drag-over' : ''}
                draggable
                onDragStart={() => onDragStart(btn.id)}
                onDragEnd={onDragEnd}
                onDragOver={e => { e.preventDefault(); setDragOver(btn.id); }}
                onDrop={() => onDrop(btn.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '.75rem',
                  padding: '.6rem .75rem',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: btn.color || '#f8fafc',
                  cursor: 'grab',
                  opacity: dragging === btn.id ? 0.4 : 1,
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{btn.button_type === 'layout' ? '📋' : '📬'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {btn.label || (btn.button_type === 'layout' ? btn.target_name : btn.scan_token)}
                  </div>
                  <div style={{ fontSize: '.7rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
                    {btn.button_type === 'layout' ? `→ ${btn.target_share_code}` : btn.scan_token}
                  </div>
                </div>
                <span style={{ fontSize: '.7rem', color: 'var(--muted)', background: 'rgba(0,0,0,.06)', borderRadius: 6, padding: '.2rem .45rem' }}>
                  {btn.button_type}
                </span>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: '.7rem', padding: '.3rem .6rem' }}
                  onClick={() => handleRemoveButton(btn.id)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
            <button className="btn btn-primary" style={{ flex: 1, fontSize: '.85rem' }} onClick={() => navigate(`/add/${shareCode}`)}>
              + Token Button
            </button>
            <button className="btn btn-ghost" style={{ flex: 1, fontSize: '.85rem' }} onClick={() => { setAddingLayout(true); setLayoutErr(''); }}>
              + Layout Button
            </button>
          </div>
        </div>

        {/* Add layout button form */}
        {addingLayout && (
          <div className="card">
            <h4 style={{ fontSize: '.875rem', marginBottom: '.75rem' }}>Add Layout Button</h4>
            <form onSubmit={handleAddLayoutButton} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Target layout share code</label>
                <input
                  autoFocus
                  value={layoutCode}
                  onChange={e => setLayoutCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="e.g. AB3X7Z"
                  style={{ fontFamily: 'monospace', letterSpacing: '.1em', textTransform: 'uppercase' }}
                  maxLength={6}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Button label (optional)</label>
                <input value={layoutLabel} onChange={e => setLayoutLabel(e.target.value)} placeholder="Leave blank to use layout name" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Color</label>
                <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.25rem' }}>
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setLayoutColor(c)} style={{ width: '1.75rem', height: '1.75rem', background: c, border: layoutColor === c ? '2.5px solid #0ea5e9' : '1.5px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              {layoutErr && <p style={{ color: '#dc2626', fontSize: '.8rem' }}>{layoutErr}</p>}
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button className="btn btn-primary" type="submit" disabled={saving} style={{ flex: 1 }}>{saving ? '…' : 'Add'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setAddingLayout(false); setLayoutCode(''); setLayoutLabel(''); setLayoutErr(''); }}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Danger zone */}
        <div className="card" style={{ borderColor: '#fecaca' }}>
          <h4 style={{ fontSize: '.875rem', color: '#dc2626', marginBottom: '.75rem' }}>Danger Zone</h4>
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleDeleteLayout}>
            Delete this Layout
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
