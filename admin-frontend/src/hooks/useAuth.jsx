// Simple auth context backed by localStorage
import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || null);
  const [orgId, setOrgId] = useState(() => localStorage.getItem('admin_orgId') || null);

  function login(data) {
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_orgId', data.orgId);
    setToken(data.token);
    setOrgId(data.orgId);
  }

  function logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_orgId');
    setToken(null);
    setOrgId(null);
  }

  return (
    <AuthContext.Provider value={{ token, orgId, login, logout, isAuth: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
