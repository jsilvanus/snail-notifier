import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';

const ALL_CHANNELS = ['general', 'push', 'email', 'sms', 'whatsapp', 'telegram', 'slack', 'teams'];
const CHANNEL_LABELS = { general: 'General (default)', push: 'Push', email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', telegram: 'Telegram', slack: 'Slack', teams: 'Teams' };

export default function CodeDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [code, setCode] = useState(null);
  const [members, setMembers] = useState([]);
  const [fields, setFields] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Metadata editing
  const [editMeta, setEditMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({});
  const [savingMeta, setSavingMeta] = useState(false);

  // Invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  // Input fields
  const [newField, setNewField] = useState({ label: '', placeholder: '', field_type: 'text', required: true });
  const [addingField, setAddingField] = useState(false);

  // Channel messages
  const [editMsg, setEditMsg] = useState(null); // { channel, message_template }
  const [savingMsg, setSavingMsg] = useState(false);

  async function load() {
    try {
      const [allCodes, membersData, msgsData] = await Promise.all([
        api.listCodes(token),
        api.listMembers(id, token),
        api.listMessages(id, token),
      ]);
      const c = allCodes.find(x => x.id === id);
      if (!c) { setError('Code not found'); return; }
      setCode(c);
      setMetaForm({ title: c.title || '', description: c.description || '', notification_message: c.notification_message || '', mailbox_label: c.mailbox_label || '' });
      setMembers(membersData);
      setMessages(msgsData);
      if (c.behavior === 'data_input') setFields(await api.listFields(id, token));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id, token]);

  async function handleSaveMeta(e) {
    e.preventDefault();
    setSavingMeta(true);
    try {
      await api.updateCode(id, metaForm, token);
      setCode(c => ({ ...c, ...metaForm }));
      setEditMeta(false);
    } catch (err) { alert(err.message); }
    setSavingMeta(false);
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true); setInviteMsg('');
    try {
      await api.inviteMember(id, inviteEmail, token);
      setInviteMsg(`Consent email sent to ${inviteEmail}`);
      setInviteEmail('');
      setMembers(await api.listMembers(id, token));
    } catch (err) { setInviteMsg(`Error: ${err.message}`); }
    setInviting(false);
  }

  async function handleAddField(e) {
    e.preventDefault();
    setAddingField(true);
    try {
      await api.createField(id, newField, token);
      setFields(await api.listFields(id, token));
      setNewField({ label: '', placeholder: '', field_type: 'text', required: true });
    } catch (err) { alert(err.message); }
    setAddingField(false);
  }

  async function handleDeleteField(fid) {
    if (!window.confirm('Delete this field?')) return;
    try { await api.deleteField(id, fid, token); setFields(f => f.filter(x => x.id !== fid)); } catch (err) { alert(err.message); }
  }

  async function handleSaveMsg(e) {
    e.preventDefault();
    setSavingMsg(true);
    try {
      await api.setMessage(id, editMsg.channel, editMsg.message_template, token);
      setMessages(await api.listMessages(id, token));
      setEditMsg(null);
    } catch (err) { alert(err.message); }
    setSavingMsg(false);
  }

  async function handleDeleteMsg(channel) {
    try { await api.deleteMessage(id, channel, token); setMessages(ms => ms.filter(m => m.channel !== channel)); } catch (err) { alert(err.message); }
  }

  if (loading) return <div className="page"><p>Loading…</p></div>;
  if (error) return <div className="page"><p className="error">{error}</p></div>;

  const statusColor = { accepted: '#16a34a', pending: '#b45309', declined: '#dc2626' };
  const msgMap = Object.fromEntries(messages.map(m => [m.channel, m.message_template]));

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn-ghost" onClick={() => navigate('/codes')} style={{ padding: '.3rem .75rem' }}>← Back</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>{code.title || code.name}</h2>
          {code.title && <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>Internal: {code.name}</span>}
        </div>
        <span className={`badge badge-${code.type.toLowerCase()}`}>{code.type}</span>
        <span style={{ fontSize: '.85rem', color: code.behavior === 'data_input' ? '#7c3aed' : 'var(--muted)' }}>
          {code.behavior === 'data_input' ? 'Data Input' : 'Simple'}
        </span>
        <button className="btn-ghost" style={{ fontSize: '.8rem' }} onClick={() => setEditMeta(v => !v)}>
          {editMeta ? 'Cancel' : 'Edit details'}
        </button>
      </div>

      {/* Description shown to end users */}
      {code.description && !editMeta && (
        <div className="card" style={{ marginBottom: '1.25rem', background: '#f0fdf4', borderLeft: '4px solid #16a34a' }}>
          <p style={{ margin: 0, fontSize: '.9rem' }}>{code.description}</p>
        </div>
      )}

      {/* Metadata editor */}
      {editMeta && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Edit Token Details</h3>
          <form onSubmit={handleSaveMeta}>
            <div className="form-group">
              <label>Public title</label>
              <input value={metaForm.title} onChange={e => setMetaForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Mailbox 3B" />
            </div>
            <div className="form-group">
              <label>Description (shown in consent email and to recipients)</label>
              <textarea value={metaForm.description} onChange={e => setMetaForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group">
              <label>Mailbox label</label>
              <input value={metaForm.mailbox_label} onChange={e => setMetaForm(f => ({ ...f, mailbox_label: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Default notification message
                {code.behavior === 'data_input' && <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}> — use {'{FIELDLABEL}'} for field values</span>}
              </label>
              <input value={metaForm.notification_message} onChange={e => setMetaForm(f => ({ ...f, notification_message: e.target.value }))}
                placeholder={code.behavior === 'data_input' ? '{NAME} wants to contact you.' : 'You have mail!'} />
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="btn-primary" type="submit" disabled={savingMeta}>{savingMeta ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn-ghost" onClick={() => setEditMeta(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Per-channel message templates */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '.5rem' }}>Notification Messages</h3>
        <p style={{ fontSize: '.875rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          Customize what recipients see per channel. Use <code>{'{FIELDLABEL}'}</code> to insert scanner input (e.g. <code>{'{NAME}'} wants to contact you.</code>).
          Channels without a custom message fall back to the default above.
        </p>
        <table>
          <thead><tr><th>Channel</th><th>Template</th><th></th></tr></thead>
          <tbody>
            {ALL_CHANNELS.map(ch => (
              <tr key={ch}>
                <td style={{ fontWeight: 600, width: 120 }}>{CHANNEL_LABELS[ch]}</td>
                <td style={{ fontSize: '.875rem', color: msgMap[ch] ? 'inherit' : 'var(--muted)' }}>
                  {editMsg?.channel === ch ? (
                    <form onSubmit={handleSaveMsg} style={{ display: 'flex', gap: '.4rem' }}>
                      <input value={editMsg.message_template} onChange={e => setEditMsg(m => ({ ...m, message_template: e.target.value }))}
                        style={{ flex: 1, fontSize: '.85rem' }} required />
                      <button className="btn-primary" type="submit" disabled={savingMsg} style={{ fontSize: '.8rem', padding: '.25rem .6rem' }}>Save</button>
                      <button type="button" className="btn-ghost" onClick={() => setEditMsg(null)} style={{ fontSize: '.8rem', padding: '.25rem .6rem' }}>✕</button>
                    </form>
                  ) : (msgMap[ch] || <em>default</em>)}
                </td>
                <td>
                  {editMsg?.channel !== ch && (
                    <div style={{ display: 'flex', gap: '.3rem' }}>
                      <button className="btn-ghost" style={{ fontSize: '.75rem', padding: '.2rem .5rem' }}
                        onClick={() => setEditMsg({ channel: ch, message_template: msgMap[ch] || '' })}>Edit</button>
                      {msgMap[ch] && (
                        <button className="btn-danger" style={{ fontSize: '.75rem', padding: '.2rem .5rem' }}
                          onClick={() => handleDeleteMsg(ch)}>Reset</button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite members */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '.75rem' }}>Invite a Member</h3>
        <p style={{ fontSize: '.875rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          A GDPR consent email is sent explaining what data is stored. Notifications are only sent once the recipient accepts.
        </p>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: '.5rem' }}>
          <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder="member@example.com" required style={{ flex: 1 }} />
          <button className="btn-primary" type="submit" disabled={inviting}>{inviting ? 'Sending…' : 'Send Invite'}</button>
        </form>
        {inviteMsg && (
          <p style={{ marginTop: '.75rem', fontSize: '.875rem', color: inviteMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{inviteMsg}</p>
        )}
      </div>

      {/* Members list */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Members ({members.length})</h3>
        {members.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No members yet.</p>
        ) : (
          <table>
            <thead><tr><th>Email</th><th>Status</th><th>Paused</th><th>Invited</th><th>Responded</th></tr></thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td>{m.email}</td>
                  <td><span style={{ fontWeight: 600, color: statusColor[m.status] || 'var(--muted)' }}>{m.status}</span></td>
                  <td>{m.paused ? 'Yes' : '—'}</td>
                  <td>{new Date(m.invited_at).toLocaleDateString()}</td>
                  <td>{m.responded_at ? new Date(m.responded_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Input fields for data_input tokens */}
      {code.behavior === 'data_input' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Input Fields</h3>
          <p style={{ fontSize: '.875rem', color: 'var(--muted)', marginBottom: '1rem' }}>
            Fields shown to the scanner at scan time. Use the field label in UPPERCASE as a template placeholder, e.g. if the label is "Name" use <code>{'{NAME}'}</code>.
          </p>
          {fields.length > 0 && (
            <table style={{ marginBottom: '1.5rem' }}>
              <thead><tr><th>Label</th><th>Placeholder token</th><th>Type</th><th>Req.</th><th></th></tr></thead>
              <tbody>
                {fields.map(f => (
                  <tr key={f.id}>
                    <td>{f.label}</td>
                    <td><code style={{ fontSize: '.8rem' }}>{`{${f.label.toUpperCase()}}`}</code></td>
                    <td>{f.field_type}</td>
                    <td>{f.required ? 'Yes' : 'No'}</td>
                    <td><button className="btn-danger" style={{ padding: '.2rem .6rem', fontSize: '.8rem' }} onClick={() => handleDeleteField(f.id)}>Remove</button></td>
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
                <input value={newField.label} onChange={e => setNewField(f => ({ ...f, label: e.target.value }))} placeholder="Name" required />
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
