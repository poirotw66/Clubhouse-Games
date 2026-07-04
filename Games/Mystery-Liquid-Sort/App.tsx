import React from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Game from './components/Game';
import { Home } from './components/Home';

export default function App() {
  return (
    <HashRouter>
      <BackToMenu />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}