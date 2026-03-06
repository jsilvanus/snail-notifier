import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LayoutList from './pages/LayoutList.jsx';
import Board from './pages/Board.jsx';
import EditLayout from './pages/EditLayout.jsx';
import AddToken from './pages/AddToken.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LayoutList />} />
        <Route path="/board/:shareCode" element={<Board />} />
        <Route path="/board/:shareCode/edit" element={<EditLayout />} />
        <Route path="/add/:shareCode" element={<AddToken />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
