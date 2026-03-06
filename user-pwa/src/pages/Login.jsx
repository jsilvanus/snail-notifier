import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = mode === 'register' ? await api.registerUser(form) : await api.loginUser(form);
      login(data);
      navigate('/notifications');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '3rem' }}>📬</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Snail Notifier</h1>
          <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Get notified when your mail arrives</p>
        </div>

        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem' }}>
          <button
            style={{ flex: 1, borderRadius: '99px', padding: '.5rem', fontSize: '.9rem' }}
            className={mode === 'login' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setMode('login')}>Login</button>
          <button
            style={{ flex: 1, borderRadius: '99px', padding: '.5rem', fontSize: '.9rem' }}
            className={mode === 'register' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setMode('register')}>Sign up</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', borderRadius: '99px', marginTop: '.25rem' }}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
