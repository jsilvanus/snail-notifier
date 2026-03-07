import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Header from './components/Header';
import Login from './pages/Login';
import Notifications from './pages/Notifications';
import Tokens from './pages/Tokens';

function PrivateRoute({ children }) {
  const { isAuth } = useAuth();
  return isAuth ? children : <Navigate to="/login" replace />;
}

function Layout({ children }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/notifications" element={
            <PrivateRoute>
              <Layout><Notifications /></Layout>
            </PrivateRoute>
          } />
          <Route path="/tokens" element={
            <PrivateRoute>
              <Layout><Tokens /></Layout>
            </PrivateRoute>
          } />
          <Route path="*" element={<Navigate to="/notifications" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
