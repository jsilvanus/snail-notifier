import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, loadState, addSavedLayout, removeSavedLayout, setHomeLayout } from '../api.js';

export default function LayoutList() {
  const navigate = useNavigate();
  const [state, setState] = useState(loadState);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const layout = await api.createLayout(newName.trim());
      const next = addSavedLayout(layout.share_code, layout.name);
      setState(next);
      setNewName('');
      setCreating(false);
      navigate(`/board/${layout.share_code}`);
    } catch (err) {
      alert(`Failed to create layout: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoinError('');
    setLoading(true);
    try {
      const layout = await api.getLayout(code);
      const next = addSavedLayout(layout.share_code, layout.name);
      setState(next);
      setJoinCode('');
      navigate(`/board/${layout.share_code}`);
    } catch (err) {
      setJoinError('Layout not found — check the share code and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleRemove(shareCode) {
    const next = removeSavedLayout(shareCode);
    setState(next);
  }

  function handleSetHome(shareCode) {
    const next = setHomeLayout(shareCode);
    setState(next);
  }

  const { layouts, home } = state;

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header>
        <span className="brand">📬 Notifier</span>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 520, margin: '0 auto', width: '100%' }}>

        {layouts.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>📋</div>
            <p>No layouts yet. Create one or join with a share code.</p>
          </div>
        )}

        {layouts.map(l => (
          <div key={l.shareCode} className="card" style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/board/${l.shareCode}`)}>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{l.name}</div>
              <div style={{ fontSize: '.75rem', color: 'var(--muted)', fontFamily: 'monospace', marginTop: '.15rem' }}>
                {l.shareCode}
                {l.shareCode === home && <span style={{ marginLeft: '.5rem', background: '#dbeafe', color: '#0369a1', borderRadius: 99, padding: '.1rem .45rem', fontSize: '.7rem', fontFamily: 'inherit', fontWeight: 600 }}>Home</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.4rem' }}>
              {l.shareCode !== home && (
                <button className="btn btn-ghost" style={{ fontSize: '.7rem', padding: '.3rem .6rem' }} onClick={() => handleSetHome(l.shareCode)} title="Set as home">
                  ⭐
                </button>
              )}
              <button className="btn btn-danger" style={{ fontSize: '.7rem', padding: '.3rem .6rem' }} onClick={() => handleRemove(l.shareCode)} title="Remove from list">
                ✕
              </button>
            </div>
          </div>
        ))}

        {/* Create new layout */}
        {creating ? (
          <form onSubmit={handleCreate} className="card" style={{ display: 'flex', gap: '.5rem' }}>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Layout name…" required />
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
              {loading ? '…' : 'Create'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setCreating(false); setNewName(''); }}>Cancel</button>
          </form>
        ) : (
          <button className="btn btn-primary" style={{ padding: '.85rem', fontSize: '1rem', borderRadius: 12 }} onClick={() => setCreating(true)}>
            + New Layout
          </button>
        )}

        {/* Join by share code */}
        <div className="card">
          <h4 style={{ marginBottom: '.75rem', fontSize: '.875rem', color: 'var(--muted)' }}>Join a shared layout</h4>
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: '.5rem' }}>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="Share code (e.g. AB3X7Z)"
              style={{ fontFamily: 'monospace', letterSpacing: '.1em', textTransform: 'uppercase' }}
              maxLength={6}
            />
            <button className="btn btn-ghost" type="submit" disabled={loading || joinCode.length < 4} style={{ whiteSpace: 'nowrap' }}>
              {loading ? '…' : 'Join'}
            </button>
          </form>
          {joinError && <p style={{ color: '#dc2626', fontSize: '.8rem', marginTop: '.5rem' }}>{joinError}</p>}
        </div>
      </div>
    </div>
  );
}
