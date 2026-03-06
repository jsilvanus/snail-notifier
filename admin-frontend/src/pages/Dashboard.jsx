import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { token } = useAuth();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listCodes(token).then(setCodes).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Dashboard</h2>
        <Link to="/codes/new">
          <button className="btn-primary">+ New Code</button>
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Total codes" value={codes.length} />
        <StatCard label="QR codes" value={codes.filter(c => c.type === 'QR').length} />
        <StatCard label="NFC codes" value={codes.filter(c => c.type === 'NFC').length} />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Recent Codes</h3>
        {loading ? <p>Loading…</p> : codes.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No codes yet. <Link to="/codes/new">Create your first one.</Link></p>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Type</th><th>Mailbox</th><th>Contact</th><th>Created</th></tr>
            </thead>
            <tbody>
              {codes.slice(0, 5).map(c => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><span className={`badge badge-${c.type.toLowerCase()}`}>{c.type}</span></td>
                  <td>{c.mailbox_label || '—'}</td>
                  <td>{c.contact_email || c.contact_phone || '—'}</td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>{value}</div>
      <div style={{ color: 'var(--muted)', fontSize: '.875rem' }}>{label}</div>
    </div>
  );
}
