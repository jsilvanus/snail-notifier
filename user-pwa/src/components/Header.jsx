import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Header() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <span className="brand">📬 Snail Notifier</span>
      <nav style={{ display: 'flex', gap: '.75rem', flex: 1 }}>
        <Link to="/notifications" style={{ color: 'inherit', textDecoration: 'none', fontSize: '.9rem' }}>Notifications</Link>
        <Link to="/tokens" style={{ color: 'inherit', textDecoration: 'none', fontSize: '.9rem' }}>My Tokens</Link>
      </nav>
      <button onClick={handleLogout} style={{ borderRadius: '99px' }}>Logout</button>
    </header>
  );
}
