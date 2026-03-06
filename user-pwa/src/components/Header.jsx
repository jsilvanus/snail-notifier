import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Header() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header>
      <span className="brand">📬 Snail Notifier</span>
      <button onClick={handleLogout} style={{ borderRadius: '99px' }}>Logout</button>
    </header>
  );
}
