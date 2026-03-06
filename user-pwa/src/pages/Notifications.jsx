import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';

const POLL_INTERVAL = 30_000; // 30 s

/**
 * Convert a URL-safe base64 VAPID public key to a Uint8Array
 * for use with pushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export default function Notifications() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState('idle'); // idle | subscribing | subscribed | unsubscribing | unsupported
  const [pushError, setPushError] = useState('');

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications(token);
      setNotifications(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  // Initial load + polling
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Check existing push subscription on mount
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setPushStatus(sub ? 'subscribed' : 'idle');
      });
    });
  }, []);

  async function handleSubscribe() {
    setPushError('');
    setPushStatus('subscribing');
    try {
      const { publicKey } = await api.getVapidKey();
      if (!publicKey) throw new Error('Push notifications not configured on server');

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await api.subscribe(subscription.toJSON(), token);
      setPushStatus('subscribed');
    } catch (err) {
      setPushError(err.message);
      setPushStatus('idle');
    }
  }

  async function handleUnsubscribe() {
    setPushStatus('unsubscribing');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await api.unsubscribe(token);
      setPushStatus('idle');
    } catch (err) {
      setPushError(err.message);
      setPushStatus('subscribed');
    }
  }

  return (
    <div className="page">
      {/* Push Notification Setup Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ marginBottom: '.5rem' }}>🔔 Push Notifications</h3>
        {pushStatus === 'unsupported' && (
          <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>
            Your browser does not support push notifications. You can still poll for updates below.
          </p>
        )}
        {pushStatus === 'subscribed' && (
          <div>
            <p style={{ color: 'var(--success)', fontWeight: 600, marginBottom: '.5rem' }}>✅ Push notifications enabled</p>
            <button className="btn-danger" style={{ fontSize: '.875rem', padding: '.4rem 1rem' }}
              onClick={handleUnsubscribe}>Disable</button>
          </div>
        )}
        {(pushStatus === 'idle' || pushStatus === 'subscribing') && pushStatus !== 'unsupported' && (
          <div>
            <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginBottom: '.75rem' }}>
              Enable push notifications to be alerted the instant your mail arrives.
            </p>
            <button className="btn-primary" onClick={handleSubscribe} disabled={pushStatus === 'subscribing'}
              style={{ fontSize: '.875rem' }}>
              {pushStatus === 'subscribing' ? 'Enabling…' : '🔔 Enable Push Notifications'}
            </button>
          </div>
        )}
        {pushStatus === 'unsubscribing' && <p style={{ color: 'var(--muted)' }}>Disabling…</p>}
        {pushError && <p className="error" style={{ marginTop: '.5rem' }}>{pushError}</p>}
      </div>

      {/* Notification History */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
        <h3>Mail Notifications</h3>
        <button className="btn-ghost" style={{ fontSize: '.8rem', padding: '.3rem .75rem' }}
          onClick={fetchNotifications}>Refresh</button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : notifications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>📭</div>
          <p style={{ color: 'var(--muted)' }}>No mail notifications yet.</p>
        </div>
      ) : (
        notifications.map(n => (
          <div key={n.id} className="notif-card">
            <div className="notif-icon">📬</div>
            <div className="notif-body">
              <strong>{n.mailbox_label || n.code_name || 'Your mailbox'} has mail!</strong>
              <small>{new Date(n.sent_at).toLocaleString()}</small>
              <div style={{ marginTop: '.25rem' }}>
                <span className="tag">{n.code_type}</span>
                <span className="tag" style={{ background: n.status === 'sent' ? '#d1fae5' : '#fee2e2', color: n.status === 'sent' ? '#065f46' : '#991b1b' }}>
                  {n.status}
                </span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
