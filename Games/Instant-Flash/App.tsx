import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import Results from './components/Results';
import { GameState, GameStats } from './types';
import { Sword, Info } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [lastStats, setLastStats] = useState<GameStats | null>(null);

  const startGame = () => {
    setGameState(GameState.PLAYING);
    setLastStats(null);
  };

  const handleGameOver = (stats: GameStats) => {
    setLastStats(stats);
    setGameState(GameState.GAMEOVER);
  };

  return (
    <div className="w-full h-screen bg-slate-950 flex flex-col overflow-hidden font-sans text-slate-200 select-none">
      
      {/* Scanline Overlay */}
      <div className="fixed inset-0 crt-overlay z-50 pointer-events-none opacity-20"></div>

      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-[url('https://images.unsplash.com/photo-1514539079130-25950c84af65?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"></div>
          
          <div className="relative z-10 text-center max-w-md p-8 animate-fade-in">
             <div className="mb-6 inline-block p-4 rounded-full bg-slate-800/50 border border-slate-600 shadow-2xl">
                <Sword size={48} className="text-emerald-400" />
             </div>
             
             <h1 className="text-5xl md:text-6xl font-display font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-300 to-cyan-500 mb-2 drop-shadow-sm">
               INSTANT FLASH
             </h1>
             <p className="text-slate-400 font-display tracking-[0.3em] mb-12 text-sm">IAI TRAINING GROUNDS</p>
             
             <div className="space-y-4">
                 <button 
                    onClick={startGame}
                    className="w-full group relative px-8 py-4 bg-slate-100 text-slate-900 font-black font-display text-xl tracking-wider clip-path-slant hover:bg-emerald-400 transition-colors"
                 >
                    <span className="absolute inset-0 w-1 bg-slate-900/10 group-hover:w-full transition-all duration-300 origin-left"></span>
                    <span className="relative">ENTER DOJO</span>
                 </button>
             </div>

             <div className="mt-12 text-left bg-slate-900/80 p-6 rounded-lg border border-slate-700/50 text-sm text-slate-400 leading-relaxed">
                 <div className="flex items-center gap-2 mb-2 text-emerald-400 font-bold uppercase">
                    <Info size={16} /> How to Play
                 </div>
                 <ol className="list-decimal pl-5 space-y-2">
                     <li>Hold <strong className="text-white">SPACE</strong> or <strong className="text-white">TOUCH</strong> to enter Sheathe Stance.</li>
                     <li>Watch for the enemy's <span className="text-red-500 font-bold">RED FLASH</span>.</li>
                     <li>Release <strong className="text-white">IMMEDIATELY</strong> as the attack hits.</li>
                     <li>Release too early = Miss. Too late = Damage.</li>
                 </ol>
             </div>
          </div>
        </div>
      )}

      {/* Game Layer - Key ensures fresh instance on restart */}
      <GameCanvas 
        key={gameState === GameState.PLAYING ? 'playing' : 'menu'}
        gameActive={gameState === GameState.PLAYING} 
        onGameOver={handleGameOver} 
      />

      {/* Results Overlay */}
      {gameState === GameState.GAMEOVER && lastStats && (
        <Results stats={lastStats} onRestart={startGame} />
      )}
    </div>
  );
}