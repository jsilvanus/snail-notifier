import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';

export default function CodeDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [codes, setCodes] = useState(null);
  const [members, setMembers] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  const [newField, setNewField] = useState({ label: '', placeholder: '', field_type: 'text', required: true });
  const [addingField, setAddingField] = useState(false);

  async function load() {
    try {
      const [allCodes, membersData] = await Promise.all([
        api.listCodes(token),
        api.listMembers(id, token),
      ]);
      const code = allCodes.find(c => c.id === id);
      if (!code) { setError('Code not found'); return; }
      setCodes(code);
      setMembers(membersData);
      if (code.behavior === 'data_input') {
        setFields(await api.listFields(id, token));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id, token]);

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    setInviteMsg('');
    try {
      await api.inviteMember(id, inviteEmail, token);
      setInviteMsg(`Consent email sent to ${inviteEmail}`);
      setInviteEmail('');
      setMembers(await api.listMembers(id, token));
    } catch (err) {
      setInviteMsg(`Error: ${err.message}`);
    } finally {
      setInviting(false);
    }
  }

  async function handleAddField(e) {
    e.preventDefault();
    setAddingField(true);
    try {
      await api.createField(id, newField, token);
      setFields(await api.listFields(id, token));
      setNewField({ label: '', placeholder: '', field_type: 'text', required: true });
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingField(false);
    }
  }

  async function handleDeleteField(fid) {
    if (!window.confirm('Delete this field?')) return;
    try {
      await api.deleteField(id, fid, token);
      setFields(f => f.filter(x => x.id !== fid));
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <div className="page"><p>Loading…</p></div>;
  if (error) return <div className="page"><p className="error">{error}</p></div>;

  const statusColor = { accepted: '#16a34a', pending: '#b45309', declined: '#dc2626' };

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn-ghost" onClick={() => navigate('/codes')} style={{ padding: '.3rem .75rem' }}>← Back</button>
        <h2 style={{ margin: 0 }}>{codes.name}</h2>
        <span className={`badge badge-${codes.type.toLowerCase()}`}>{codes.type}</span>
        <span style={{ fontSize: '.85rem', color: codes.behavior === 'data_input' ? '#7c3aed' : 'var(--muted)' }}>
          {codes.behavior === 'data_input' ? 'Data Input' : 'Simple'}
        </span>
      </div>

      {/* ── Invite members ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Invite a Member</h3>
        <p style={{ fontSize: '.875rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          A consent email will be sent. The recipient can accept or decline. Notifications are only sent once they accept.
        </p>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: '.5rem' }}>
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="member@example.com"
            required
            style={{ flex: 1 }}
          />
          <button className="btn-primary" type="submit" disabled={inviting}>
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </form>
        {inviteMsg && (
          <p style={{ marginTop: '.75rem', fontSize: '.875rem', color: inviteMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>
            {inviteMsg}
          </p>
        )}
      </div>

      {/* ── Members list ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Members ({members.length})</h3>
        {members.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No members yet. Invite someone above.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Email</th><th>Status</th><th>Paused</th><th>Invited</th><th>Responded</th></tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td>{m.email}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: statusColor[m.status] || 'var(--muted)' }}>
                      {m.status}
                    </span>
                  </td>
                  <td>{m.paused ? 'Yes' : '—'}</td>
                  <td>{new Date(m.invited_at).toLocaleDateString()}</td>
                  <td>{m.responded_at ? new Date(m.responded_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Input fields (data_input only) ── */}
      {codes.behavior === 'data_input' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Input Fields</h3>
          <p style={{ fontSize: '.875rem', color: 'var(--muted)', marginBottom: '1rem' }}>
            These fields are shown to the scanner when they scan this code. Their answers are included in the notification to members.
          </p>

          {fields.length > 0 && (
            <table style={{ marginBottom: '1.5rem' }}>
              <thead>
                <tr><th>Label</th><th>Type</th><th>Required</th><th></th></tr>
              </thead>
              <tbody>
                {fields.map(f => (
                  <tr key={f.id}>
                    <td>{f.label}{f.placeholder ? <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}> — {f.placeholder}</span> : ''}</td>
                    <td>{f.field_type}</td>
                    <td>{f.required ? 'Yes' : 'No'}</td>
                    <td>
                      <button className="btn-danger" style={{ padding: '.2rem .6rem', fontSize: '.8rem' }}
                        onClick={() => handleDeleteField(f.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <form onSubmit={handleAddField}>
            <h4 style={{ marginBottom: '.75rem' }}>Add Field</h4>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '2', minWidth: 160 }}>
                <label>Label *</label>
                <input value={newField.label} onChange={e => setNewField(f => ({ ...f, label: e.target.value }))} placeholder="Your name" required />
              </div>
              <div className="form-group" style={{ flex: '2', minWidth: 160 }}>
                <label>Placeholder</label>
                <input value={newField.placeholder} onChange={e => setNewField(f => ({ ...f, placeholder: e.target.value }))} placeholder="e.g. Alice" />
              </div>
              <div className="form-group" style={{ flex: '1', minWidth: 120 }}>
                <label>Type</label>
                <select value={newField.field_type} onChange={e => setNewField(f => ({ ...f, field_type: e.target.value }))}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: '1', minWidth: 100, display: 'flex', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: 0 }}>
                  <input type="checkbox" checked={newField.required} onChange={e => setNewField(f => ({ ...f, required: e.target.checked }))} />
                  Required
                </label>
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={addingField} style={{ marginTop: '.5rem' }}>
              {addingField ? 'Adding…' : '+ Add Field'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
