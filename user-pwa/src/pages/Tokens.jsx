import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';

const ALL_CHANNELS = ['push', 'email', 'sms', 'whatsapp', 'telegram', 'slack', 'teams'];
const CHANNEL_LABELS = { push: 'Push', email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', telegram: 'Telegram', slack: 'Slack', teams: 'Teams' };

function PrivacyModal({ tokenName, orgName, description, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '.75rem', right: '.75rem', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        <h3 style={{ marginBottom: '.75rem' }}>Privacy Information</h3>
        <p style={{ fontWeight: 600, marginBottom: '.5rem' }}>{tokenName} &mdash; {orgName}</p>
        {description && <p style={{ fontSize: '.9rem', color: 'var(--muted)', marginBottom: '1rem' }}>{description}</p>}
        <h4 style={{ marginBottom: '.5rem' }}>What data is stored</h4>
        <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8, fontSize: '.9rem' }}>
          <li>Your email address</li>
          <li>Your notification channel contact details you choose to add (phone number, Telegram ID, etc.)</li>
          <li>A log of when notifications were sent to you (timestamp, channel, delivery status)</li>
          <li>Your channel preferences per token</li>
        </ul>
        <h4 style={{ marginTop: '1rem', marginBottom: '.5rem' }}>Your rights</h4>
        <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8, fontSize: '.9rem' }}>
          <li>You can pause or leave any token at any time</li>
          <li>Leaving removes all membership data for this token</li>
          <li>Your data is only used to deliver notifications you have consented to receive</li>
        </ul>
        <button className="btn-primary" onClick={onClose} style={{ marginTop: '1rem', width: '100%' }}>Close</button>
      </div>
    </div>
  );
}

export default function Tokens() {
  const { token } = useAuth();
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [channelPrefs, setChannelPrefs] = useState({});
  const [userChannels, setUserChannels] = useState([]);
  const [editChannel, setEditChannel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [privacyModal, setPrivacyModal] = useState(null); // membership object

  const load = useCallback(async () => {
    try {
      const [m, uc] = await Promise.all([api.getMemberships(token), api.getUserChannels(token)]);
      setMemberships(m);
      setUserChannels(uc);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function toggleExpand(membershipId) {
    if (expanded === membershipId) { setExpanded(null); return; }
    setExpanded(membershipId);
    if (!channelPrefs[membershipId]) {
      try {
        const prefs = await api.getMembershipChannels(membershipId, token);
        setChannelPrefs(p => ({ ...p, [membershipId]: prefs }));
      } catch { /* ignore */ }
    }
  }

  async function handleChannelToggle(membershipId, channel, enabled) {
    const current = channelPrefs[membershipId] || [];
    const next = current.find(p => p.channel === channel)
      ? current.map(p => p.channel === channel ? { ...p, enabled } : p)
      : [...current, { channel, enabled }];
    setChannelPrefs(p => ({ ...p, [membershipId]: next }));
    try { await api.setMembershipChannels(membershipId, next, token); } catch (err) { alert(err.message); }
  }

  async function handlePause(m) {
    try {
      await api.updateMembership(m.id, { paused: !m.paused }, token);
      setMemberships(ms => ms.map(x => x.id === m.id ? { ...x, paused: !m.paused } : x));
    } catch (err) { alert(err.message); }
  }

  async function handleVacation(m) {
    const until = window.prompt('Delay notifications until (YYYY-MM-DD), or leave blank to clear:');
    if (until === null) return;
    const val = until.trim() || null;
    try {
      await api.updateMembership(m.id, { vacation_until: val }, token);
      setMemberships(ms => ms.map(x => x.id === m.id ? { ...x, vacation_until: val } : x));
    } catch (err) { alert(err.message); }
  }

  async function handleLeave(m) {
    if (!window.confirm(`Remove yourself from "${m.token_name}"?`)) return;
    try {
      await api.deleteMembership(m.id, token);
      setMemberships(ms => ms.filter(x => x.id !== m.id));
    } catch (err) { alert(err.message); }
  }

  async function handleSaveChannel(e) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      await api.setUserChannel(editChannel.channel, editChannel.value, token);
      setMsg(`${CHANNEL_LABELS[editChannel.channel]} contact saved. Verification pending.`);
      setEditChannel(null);
      setUserChannels(await api.getUserChannels(token));
    } catch (err) { setMsg(`Error: ${err.message}`); }
    setSaving(false);
  }

  if (loading) return <div className="page"><p>Loading…</p></div>;

  return (
    <div className="page">
      {privacyModal && <PrivacyModal {...privacyModal} onClose={() => setPrivacyModal(null)} />}

      <h2 style={{ marginBottom: '1.5rem' }}>My Tokens</h2>

      {memberships.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>📭</div>
          <p style={{ color: 'var(--muted)' }}>You have not been added to any tokens yet.</p>
        </div>
      ) : memberships.map(m => (
        <div key={m.id} className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <strong>{m.token_name}</strong>
              {m.mailbox_label && <span style={{ color: 'var(--muted)', marginLeft: '.5rem', fontSize: '.875rem' }}>{m.mailbox_label}</span>}
              <div style={{ marginTop: '.25rem', fontSize: '.8rem', display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--muted)' }}>{m.org_name}</span>
                <span style={{ fontWeight: 600, color: m.status === 'accepted' ? '#16a34a' : '#b45309' }}>{m.status}</span>
                {m.paused && <span style={{ color: '#dc2626', fontWeight: 600 }}>Paused</span>}
                {m.vacation_until && <span style={{ color: '#7c3aed' }}>Vacation until {m.vacation_until.slice(0, 10)}</span>}
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.8rem', color: 'var(--primary)', padding: 0 }}
                  onClick={() => setPrivacyModal({ tokenName: m.token_name, orgName: m.org_name, description: m.description || '' })}
                >
                  Privacy info
                </button>
              </div>
            </div>
            <button className="btn-ghost" style={{ fontSize: '.8rem', padding: '.25rem .6rem' }} onClick={() => toggleExpand(m.id)}>
              {expanded === m.id ? 'Close' : 'Manage'}
            </button>
          </div>

          {expanded === m.id && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <h4 style={{ marginBottom: '.5rem' }}>Notification channels</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '1rem' }}>
                {ALL_CHANNELS.map(ch => {
                  const prefs = channelPrefs[m.id] || [];
                  const pref = prefs.find(p => p.channel === ch);
                  const isOn = pref ? !!pref.enabled : (ch === 'push' || ch === 'email');
                  return (
                    <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.875rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={isOn} onChange={e => handleChannelToggle(m.id, ch, e.target.checked)} />
                      {CHANNEL_LABELS[ch]}
                    </label>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <button className="btn-ghost" style={{ fontSize: '.8rem' }} onClick={() => handlePause(m)}>{m.paused ? 'Resume' : 'Pause'}</button>
                <button className="btn-ghost" style={{ fontSize: '.8rem' }} onClick={() => handleVacation(m)}>{m.vacation_until ? 'Change vacation' : 'Vacation mode'}</button>
                <button className="btn-danger" style={{ fontSize: '.8rem' }} onClick={() => handleLeave(m)}>Leave token</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Channel contact info */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Contact Details for Channels</h3>
        <p style={{ fontSize: '.875rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          Add contact details so notifications can reach you via SMS, WhatsApp, Telegram, Slack, or Teams.
        </p>
        {['sms', 'whatsapp', 'telegram', 'slack', 'teams'].map(ch => {
          const saved = userChannels.find(c => c.channel === ch);
          return (
            <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.75rem' }}>
              <span style={{ width: 90, fontWeight: 600, fontSize: '.875rem' }}>{CHANNEL_LABELS[ch]}</span>
              {saved ? (
                <span style={{ fontSize: '.875rem', color: saved.verified ? '#16a34a' : '#b45309' }}>
                  {saved.value} {saved.verified ? '(verified)' : '(unverified)'}
                </span>
              ) : (
                <span style={{ fontSize: '.875rem', color: 'var(--muted)' }}>Not set</span>
              )}
              <button className="btn-ghost" style={{ fontSize: '.75rem', padding: '.2rem .6rem' }}
                onClick={() => setEditChannel({ channel: ch, value: saved?.value || '' })}>
                {saved ? 'Edit' : 'Add'}
              </button>
            </div>
          );
        })}
        {editChannel && (
          <form onSubmit={handleSaveChannel} style={{ marginTop: '1rem', display: 'flex', gap: '.5rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>{CHANNEL_LABELS[editChannel.channel]} contact</label>
              <input value={editChannel.value}
                onChange={e => setEditChannel(c => ({ ...c, value: e.target.value }))}
                placeholder={editChannel.channel === 'telegram' ? 'Chat ID (from @userinfobot)' : editChannel.channel === 'slack' || editChannel.channel === 'teams' ? 'Webhook URL' : '+15550000000'}
                required />
            </div>
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn-ghost" onClick={() => setEditChannel(null)}>Cancel</button>
          </form>
        )}
        {msg && <p style={{ marginTop: '.75rem', fontSize: '.875rem', color: msg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{msg}</p>}
      </div>
    </div>
  );
}
