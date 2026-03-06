import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Board from './pages/Board.jsx';
import AddToken from './pages/AddToken.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Board />} />
        <Route path="/add" element={<AddToken />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
