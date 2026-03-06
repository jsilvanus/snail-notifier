import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';

export default function CreateCode() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', type: 'QR', behavior: 'simple', mailbox_label: '', contact_email: '', contact_phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const code = await api.createCode(form, token);
      setCreated(code);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="page">
        <div className="card" style={{ maxWidth: 500 }}>
          <h2 style={{ marginBottom: '1rem' }}>Code Created</h2>
          <p><strong>Name:</strong> {created.name}</p>
          <p><strong>Type:</strong> {created.type}</p>
          <p><strong>Behavior:</strong> {created.behavior === 'data_input' ? 'Data Input' : 'Simple'}</p>
          {created.mailbox_label && <p><strong>Mailbox:</strong> {created.mailbox_label}</p>}
          <p style={{ marginTop: '.75rem' }}>
            <strong>Scan URL:</strong>{' '}
            <code style={{ fontSize: '.8rem', wordBreak: 'break-all' }}>{created.scan_url}</code>
          </p>
          {created.qr_data_url && (
            <div style={{ margin: '1rem 0' }}>
              <p style={{ marginBottom: '.5rem' }}><strong>QR Code:</strong></p>
              <img src={created.qr_data_url} alt="QR code" style={{ width: 200, height: 200, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
              <div style={{ marginTop: '.5rem' }}>
                <a href={created.qr_data_url} download={`${created.name}-qr.png`}>
                  <button className="btn-ghost" style={{ fontSize: '.875rem' }}>Download QR PNG</button>
                </a>
              </div>
            </div>
          )}
          {created.type === 'NFC' && (
            <div style={{ margin: '1rem 0', padding: '.75rem', background: 'var(--bg)', borderRadius: 'var(--radius)', fontSize: '.875rem' }}>
              <strong>NFC URL to program:</strong><br />
              <code style={{ wordBreak: 'break-all' }}>{created.scan_url}</code>
            </div>
          )}
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
            <button className="btn-primary" onClick={() => navigate(`/codes/${created.id}`)}>
              {created.behavior === 'data_input' ? 'Add Input Fields' : 'Invite Members'}
            </button>
            <button className="btn-ghost" onClick={() => setCreated(null)}>Create Another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 500 }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Create Code</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Code name *</label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Apartment 3B" required />
          </div>
          <div className="form-group">
            <label>Type *</label>
            <select value={form.type} onChange={set('type')}>
              <option value="QR">QR Code</option>
              <option value="NFC">NFC Tag</option>
            </select>
          </div>
          <div className="form-group">
            <label>Behavior *</label>
            <select value={form.behavior} onChange={set('behavior')}>
              <option value="simple">Simple — notify on scan</option>
              <option value="data_input">Data Input — ask scanner for info, then notify</option>
            </select>
            {form.behavior === 'data_input' && (
              <p style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.4rem' }}>
                You can add input fields (e.g. "Your name") after creating this code. The scanner's answers will be included in the notification.
              </p>
            )}
          </div>
          <div className="form-group">
            <label>Mailbox label</label>
            <input value={form.mailbox_label} onChange={set('mailbox_label')} placeholder="e.g. Box 42, Building A" />
          </div>
          <div className="form-group">
            <label>Contact email (legacy — prefer inviting members after creation)</label>
            <input type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="owner@example.com" />
          </div>
          <div className="form-group">
            <label>Contact phone (optional)</label>
            <input type="tel" value={form.contact_phone} onChange={set('contact_phone')} placeholder="+1 555 0100" />
          </div>
          {error && <p className="error">{error}</p>}
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create Code'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => navigate('/codes')}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
