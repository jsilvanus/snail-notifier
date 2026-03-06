import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ orgName: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      if (mode === 'register') {
        data = await api.registerOrg(form);
      } else {
        data = await api.loginOrg({ email: form.email, password: form.password });
      }
      login(data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>
          📬 Snail Notifier
          <span style={{ fontSize: '1rem', fontWeight: 400, display: 'block', color: 'var(--muted)' }}>
            Organisation Portal
          </span>
        </h1>

        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem' }}>
          <button className={mode === 'login' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMode('login')}>Login</button>
          <button className={mode === 'register' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMode('register')}>Register</button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <div className="form-group">
                <label>Organisation name</label>
                <input value={form.orgName} onChange={set('orgName')} placeholder="Acme Post Co." required />
              </div>
              <div className="form-group">
                <label>Your name</label>
                <input value={form.name} onChange={set('name')} placeholder="Jane Doe" required />
              </div>
            </>
          )}
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="jane@org.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '.5rem' }}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}
