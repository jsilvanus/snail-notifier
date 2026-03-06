import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function NavBar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav>
      <span className="brand">📬 Snail Notifier</span>
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/codes">Codes</Link>
      <Link to="/users">Team</Link>
      <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', padding: '.35rem .9rem', fontSize: '.875rem' }}>
        Logout
      </button>
    </nav>
  );
}
