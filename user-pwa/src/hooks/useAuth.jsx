import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('pwa_token') || null);
  const [userId, setUserId] = useState(() => localStorage.getItem('pwa_userId') || null);

  function login(data) {
    localStorage.setItem('pwa_token', data.token);
    localStorage.setItem('pwa_userId', data.userId);
    setToken(data.token);
    setUserId(data.userId);
  }

  function logout() {
    localStorage.removeItem('pwa_token');
    localStorage.removeItem('pwa_userId');
    setToken(null);
    setUserId(null);
  }

  return (
    <AuthContext.Provider value={{ token, userId, login, logout, isAuth: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
