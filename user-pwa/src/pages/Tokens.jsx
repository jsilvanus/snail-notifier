import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';

const ALL_CHANNELS = ['push', 'email', 'sms', 'whatsapp', 'telegram', 'slack'];
const CHANNEL_LABELS = { push: 'Push', email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', telegram: 'Telegram', slack: 'Slack' };

export default function Tokens() {
  const { token } = useAuth();
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // membership id
  const [channelPrefs, setChannelPrefs] = useState({}); // { [membershipId]: [{channel, enabled}] }
  const [userChannels, setUserChannels] = useState([]);
  const [editChannel, setEditChannel] = useState(null); // { channel, value }
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

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
    try {
      await api.setMembershipChannels(membershipId, next, token);
    } catch (err) {
      alert(err.message);
    }
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
    if (!window.confirm(`Remove yourself from "${m.token_name}"? You will stop receiving notifications.`)) return;
    try {
      await api.deleteMembership(m.id, token);
      setMemberships(ms => ms.filter(x => x.id !== m.id));
    } catch (err) { alert(err.message); }
  }

  async function handleSaveChannel(e) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api.setUserChannel(editChannel.channel, editChannel.value, token);
      setMsg(`${CHANNEL_LABELS[editChannel.channel]} contact saved. Verification coming soon.`);
      setEditChannel(null);
      setUserChannels(await api.getUserChannels(token));
    } catch (err) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page"><p>Loading…</p></div>;

  return (
    <div className="page">
      <h2 style={{ marginBottom: '1.5rem' }}>My Tokens</h2>

      {memberships.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>📭</div>
          <p style={{ color: 'var(--muted)' }}>You have not been added to any tokens yet.</p>
        </div>
      ) : memberships.map(m => (
        <div key={m.id} className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <strong>{m.token_name}</strong>
              {m.mailbox_label && <span style={{ color: 'var(--muted)', marginLeft: '.5rem', fontSize: '.875rem' }}>{m.mailbox_label}</span>}
              <div style={{ marginTop: '.25rem', fontSize: '.8rem' }}>
                <span style={{ color: 'var(--muted)' }}>{m.org_name}</span>
                <span style={{ marginLeft: '.75rem', fontWeight: 600, color: m.status === 'accepted' ? '#16a34a' : '#b45309' }}>
                  {m.status}
                </span>
                {m.paused && <span style={{ marginLeft: '.5rem', color: '#dc2626', fontWeight: 600 }}>Paused</span>}
                {m.vacation_until && <span style={{ marginLeft: '.5rem', color: '#7c3aed' }}>Vacation until {m.vacation_until.slice(0, 10)}</span>}
              </div>
            </div>
            <button className="btn-ghost" style={{ fontSize: '.8rem', padding: '.25rem .6rem' }}
              onClick={() => toggleExpand(m.id)}>
              {expanded === m.id ? 'Close' : 'Manage'}
            </button>
          </div>

          {expanded === m.id && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              {/* Channel prefs */}
              <h4 style={{ marginBottom: '.5rem' }}>Notification channels</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '1rem' }}>
                {ALL_CHANNELS.map(ch => {
                  const prefs = channelPrefs[m.id] || [];
                  const pref = prefs.find(p => p.channel === ch);
                  const isOn = pref ? !!pref.enabled : (ch === 'push' || ch === 'email');
                  return (
                    <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.875rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={isOn}
                        onChange={e => handleChannelToggle(m.id, ch, e.target.checked)} />
                      {CHANNEL_LABELS[ch]}
                    </label>
                  );
                })}
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <button className="btn-ghost" style={{ fontSize: '.8rem' }} onClick={() => handlePause(m)}>
                  {m.paused ? 'Resume' : 'Pause'}
                </button>
                <button className="btn-ghost" style={{ fontSize: '.8rem' }} onClick={() => handleVacation(m)}>
                  {m.vacation_until ? 'Change vacation' : 'Vacation mode'}
                </button>
                <button className="btn-danger" style={{ fontSize: '.8rem' }} onClick={() => handleLeave(m)}>
                  Leave token
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ── Channel contact info ── */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Contact Details for Channels</h3>
        <p style={{ fontSize: '.875rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          Add your phone number, Telegram ID, or other contact details so notifications can reach you via those channels.
        </p>

        {['sms', 'whatsapp', 'telegram', 'slack'].map(ch => {
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
              <input
                value={editChannel.value}
                onChange={e => setEditChannel(c => ({ ...c, value: e.target.value }))}
                placeholder={editChannel.channel === 'telegram' ? 'Chat ID (from @userinfobot)' : editChannel.channel === 'slack' ? 'Webhook URL' : '+15550000000'}
                required
              />
            </div>
            <button className="btn-primary" type="submit" disabled={saving} style={{ marginBottom: 0 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEditChannel(null)}>Cancel</button>
          </form>
        )}
        {msg && <p style={{ marginTop: '.75rem', fontSize: '.875rem', color: msg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{msg}</p>}
      </div>
    </div>
  );
}
