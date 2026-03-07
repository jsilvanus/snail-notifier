import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, addSavedLayout } from '../api.js';

function FormModal({ info, onClose, onDone }) {
  const [responses, setResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await api.submitForm(info.scanToken, responses);
      onDone('Notification sent!');
    } catch (err) {
      onDone(err.message || 'Error sending notification');
    }
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

function ShareModal({ shareCode, onClose }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(shareCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <h3 style={{ marginBottom: '.75rem' }}>Share this Layout</h3>
        <p style={{ color: 'var(--muted)', fontSize: '.875rem', marginBottom: '1rem' }}>
          Anyone with this code can view and edit this layout.
        </p>
        <div style={{ fontFamily: 'monospace', fontSize: '2rem', fontWeight: 700, textAlign: 'center', letterSpacing: '.2em', padding: '1rem', background: 'var(--bg)', borderRadius: 12, marginBottom: '1rem' }}>
          {shareCode}
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={copy}>
            {copied ? '✓ Copied!' : 'Copy Code'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Board() {
  const { shareCode } = useParams();
  const navigate = useNavigate();

  const [layout, setLayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formInfo, setFormInfo] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getLayout(shareCode);
      setLayout(data);
      // Auto-bookmark: persist this layout to localStorage so it appears in LayoutList
      // without requiring the user to manually save it. This is an intentional side effect
      // of loading a board — every visit reinforces the bookmark.
      addSavedLayout(data.share_code, data.name);
    } catch (err) {
      setError('Layout not found or could not be loaded.');
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

  async function handleTrigger(btn) {
    try {
      const data = await api.triggerScan(btn.scan_token);
      if (data.behavior === 'data_input') {
        setFormInfo({ scanToken: btn.scan_token, title: btn.label || data.title, description: data.description, tokenName: data.tokenName, fields: data.fields });
      } else {
        showToast('Notification sent!');
      }
    } catch (err) {
      showToast(err.message || 'Error');
    }
  }

  function handleFormDone(msg) {
    setFormInfo(null);
    showToast(msg);
  }

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <header>
          <button className="btn btn-ghost" style={{ fontSize: '.85rem', padding: '.35rem .75rem' }} onClick={() => navigate('/')}>← Back</button>
          <span className="brand" style={{ flex: 1, textAlign: 'center' }}>Loading…</span>
          <span style={{ width: 80 }} />
        </header>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Loading layout…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <header>
          <button className="btn btn-ghost" style={{ fontSize: '.85rem', padding: '.35rem .75rem' }} onClick={() => navigate('/')}>← Back</button>
          <span className="brand" style={{ flex: 1, textAlign: 'center' }}>Error</span>
          <span style={{ width: 80 }} />
        </header>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
          <p style={{ color: '#dc2626' }}>{error}</p>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>← Back to Layouts</button>
        </div>
      </div>
    );
  }

  const buttons = layout?.buttons || [];

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header>
        <button className="btn btn-ghost" style={{ fontSize: '.85rem', padding: '.35rem .75rem' }} onClick={() => navigate('/')}>← Back</button>
        <span className="brand" style={{ flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {layout?.name}
        </span>
        <div style={{ display: 'flex', gap: '.4rem' }}>
          <button className="btn btn-ghost" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }} onClick={() => setShowShare(true)} title="Share">
            🔗
          </button>
          <button className="btn btn-ghost" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }} onClick={() => navigate(`/board/${shareCode}/edit`)} title="Edit layout">
            ✏️
          </button>
        </div>
      </header>

      <div className="board-wrap">
        <div className="page-panel" style={{ height: '100%' }}>
          {buttons.map(btn => {
            if (btn.button_type === 'layout') {
              return (
                <div
                  key={btn.id}
                  className="token-btn"
                  style={{ background: btn.color || '#f3e8ff' }}
                  onClick={() => {
                    if (btn.target_share_code) {
                      navigate(`/board/${btn.target_share_code}`);
                    }
                  }}
                >
                  <span className="icon">📋</span>
                  <span className="label">{btn.label || btn.target_name || 'Layout'}</span>
                  {btn.target_share_code && (
                    <span className="sub" style={{ fontFamily: 'monospace' }}>{btn.target_share_code}</span>
                  )}
                </div>
              );
            }
            // token button
            return (
              <div
                key={btn.id}
                className="token-btn"
                style={{ background: btn.color || '#dbeafe' }}
                onClick={() => handleTrigger(btn)}
              >
                <span className="icon">📬</span>
                <span className="label">{btn.label || btn.scan_token}</span>
              </div>
            );
          })}

          {/* Add button */}
          <div className="token-btn add-btn" onClick={() => navigate(`/add/${shareCode}`)}>+</div>
        </div>
      </div>

      {formInfo && <FormModal info={formInfo} onClose={() => setFormInfo(null)} onDone={handleFormDone} />}
      {showShare && <ShareModal shareCode={shareCode} onClose={() => setShowShare(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
