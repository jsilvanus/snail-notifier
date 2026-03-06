import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';

export default function Codes() {
  const { token } = useAuth();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      setCodes(await api.listCodes(token));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this code?')) return;
    try {
      await api.deleteCode(id, token);
      setCodes(c => c.filter(x => x.id !== id));
    } catch (e) {
      alert(e.message);
    }
  }

  if (loading) return <div className="page"><p>Loading…</p></div>;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Codes</h2>
        <Link to="/codes/new"><button className="btn-primary">+ New Code</button></Link>
      </div>
      {error && <p className="error">{error}</p>}
      {codes.length === 0 ? (
        <div className="card"><p style={{ color: 'var(--muted)' }}>No codes yet.</p></div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Type</th><th>Behavior</th><th>Mailbox</th>
                <th>Members</th><th>QR</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/codes/${c.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                      {c.name}
                    </Link>
                  </td>
                  <td><span className={`badge badge-${c.type.toLowerCase()}`}>{c.type}</span></td>
                  <td>
                    <span style={{ fontSize: '.8rem', color: c.behavior === 'data_input' ? '#7c3aed' : 'var(--muted)' }}>
                      {c.behavior === 'data_input' ? 'Data Input' : 'Simple'}
                    </span>
                  </td>
                  <td>{c.mailbox_label || '—'}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{c.member_count || 0}</span>
                    {c.pending_invites > 0 && (
                      <span style={{ marginLeft: '.4rem', fontSize: '.75rem', color: '#b45309' }}>
                        ({c.pending_invites} pending)
                      </span>
                    )}
                  </td>
                  <td>
                    {c.type === 'QR'
                      ? <a href={`/api/codes/${c.id}/qr`} target="_blank" rel="noreferrer">Download</a>
                      : <span style={{ color: 'var(--muted)' }}>N/A</span>}
                  </td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '.4rem' }}>
                      <Link to={`/codes/${c.id}`}>
                        <button className="btn-ghost" style={{ padding: '.25rem .75rem', fontSize: '.8rem' }}>Manage</button>
                      </Link>
                      <button className="btn-danger" style={{ padding: '.25rem .75rem', fontSize: '.8rem' }}
                        onClick={() => handleDelete(c.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
