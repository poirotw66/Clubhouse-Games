import React from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Game from './components/Game';
import { Home } from './components/Home';

function NavBack() {
  const location = useLocation();
  const navigate = useNavigate();
  const isPlaying = location.pathname.startsWith('/game');
  return <BackToMenu onBackToTitle={isPlaying ? () => navigate('/') : undefined} />;
}

export default function App() {
  return (
    <HashRouter>
      <NavBack />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
