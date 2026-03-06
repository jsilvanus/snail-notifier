import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';

export default function Users() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function load() {
    try { setUsers(await api.listUsers(token)); } catch { } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  async function handleAdd(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const u = await api.createUser(form, token);
      setUsers(us => [...us, u]);
      setForm({ name: '', email: '', password: '', role: 'member' });
      setSuccess('User added.');
    } catch (err) { setError(err.message); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this user?')) return;
    try {
      await api.deleteUser(id, token);
      setUsers(us => us.filter(u => u.id !== id));
    } catch (err) { alert(err.message); }
  }

  return (
    <div className="page">
      <h2 style={{ marginBottom: '1.5rem' }}>Team Members</h2>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Add User</h3>
        <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>Name</label>
            <input value={form.name} onChange={set('name')} placeholder="Jane Doe" required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="jane@org.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={form.role} onChange={set('role')}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <button className="btn-primary" type="submit">Add User</button>
            {success && <span style={{ color: 'var(--success)' }}>{success}</span>}
            {error && <span className="error">{error}</span>}
          </div>
        </form>
      </div>

      <div className="card">
        {loading ? <p>Loading…</p> : users.length === 0 ? <p style={{ color: 'var(--muted)' }}>No users found.</p> : (
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className={`badge ${u.role === 'admin' ? 'badge-qr' : 'badge-nfc'}`}>{u.role}</span></td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-danger" style={{ padding: '.25rem .75rem', fontSize: '.8rem' }}
                      onClick={() => handleDelete(u.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
