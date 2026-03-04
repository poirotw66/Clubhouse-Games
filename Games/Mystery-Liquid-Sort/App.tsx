import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Game from './components/Game';
import { Home } from './components/Home';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}