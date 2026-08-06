import React, { useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playLose, playWin } from '@clubhouse/shared/synthAudio';
import GameCanvas from './components/GameCanvas';
import { GameState, GameStats, PlayMode } from './types';
import { loadBest, saveBest, BestRecord } from './storage';
import { Sword, Info } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [playMode, setPlayMode] = useState<PlayMode>('challenge');
  const [lastStats, setLastStats] = useState<GameStats | null>(null);
  const [best, setBest] = useState<BestRecord>(() => loadBest());
  const previousStateRef = useRef<GameState>(GameState.MENU);

  const startGame = (mode: PlayMode) => {
    setPlayMode(mode);
    setGameState(GameState.PLAYING);
    setLastStats(null);
  };

  const handleGameOver = (stats: GameStats) => {
    if (playMode === 'challenge') {
      setBest(saveBest(stats.score, stats.maxCombo));
    }
    setLastStats(stats);
    setGameState(GameState.GAMEOVER);
  };

  useEffect(() => {
    if (gameState === GameState.GAMEOVER && previousStateRef.current !== GameState.GAMEOVER && lastStats) {
      if (playMode === 'practice') {
        /* training exit — no win/lose sting */
      } else if (lastStats.score >= 5000) {
        playWin();
      } else {
        playLose();
      }
    }
    previousStateRef.current = gameState;
  }, [gameState, lastStats, playMode]);

  const isPractice = playMode === 'practice';
  const resultTitle = isPractice
    ? '練習結束'
    : lastStats && lastStats.score >= 5000
      ? '修練成功！'
      : '修練結束';
  const resultVariant = isPractice
    ? 'neutral'
    : lastStats && lastStats.score >= 5000
      ? 'win'
      : 'lose';

  return (
    <div className="w-full min-h-dvh h-screen bg-slate-950 flex flex-col overflow-hidden font-sans text-slate-200 select-none">
      <BackToMenu />

      {/* Scanline Overlay */}
      <div className="fixed inset-0 crt-overlay z-50 pointer-events-none opacity-20"></div>

      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex items-center justify-center z-40 overflow-hidden">
          {/* Local dojo atmosphere — no CDN image (unsplash + 80% black wash looked broken). */}
          <div className="absolute inset-0 bg-[#12182a]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#3d4f6f_0%,_transparent_55%)] opacity-70" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_#0f766e55_0%,_transparent_40%),radial-gradient(circle_at_80%_70%,_#7f1d1d44_0%,_transparent_35%)]" />
          <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-amber-200/10 blur-3xl" />

          <div className="relative z-10 text-center max-w-md p-8 animate-fade-in">
             <div className="mb-6 inline-block p-4 rounded-full bg-slate-800/70 border border-emerald-500/40 shadow-2xl shadow-emerald-900/40">
                <Sword size={48} className="text-emerald-400" />
             </div>

             <h1 className="text-5xl md:text-6xl font-display font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-300 to-cyan-500 mb-2 drop-shadow-sm">
               INSTANT FLASH
             </h1>
             <p className="text-slate-300 font-display tracking-[0.3em] mb-8 text-sm">武士反應訓練</p>

             {(best.highScore > 0 || best.maxCombo > 0) && (
               <p className="mb-6 text-xs text-slate-400 font-display tracking-wider">
                 個人最佳{' '}
                 <span className="text-emerald-400 tabular-nums">{best.highScore.toLocaleString()}</span>
                 {' · '}
                 最高連段{' '}
                 <span className="text-amber-400 tabular-nums">{best.maxCombo}</span>
               </p>
             )}

             <div className="space-y-3">
                 <button
                    type="button"
                    onClick={() => startGame('challenge')}
                    className="w-full group relative px-8 py-4 bg-slate-100 text-slate-900 font-black font-display text-xl tracking-wider clip-path-slant hover:bg-emerald-400 transition-colors"
                 >
                    <span className="absolute inset-0 w-1 bg-slate-900/10 group-hover:w-full transition-all duration-300 origin-left"></span>
                    <span className="relative">挑戰模式</span>
                 </button>
                 <button
                    type="button"
                    onClick={() => startGame('practice')}
                    className="w-full px-8 py-3 bg-slate-800/90 text-emerald-300 font-display font-bold text-lg tracking-wider border border-emerald-500/40 hover:bg-slate-700/90 transition-colors"
                 >
                    練習模式
                 </button>
                 <p className="text-slate-500 text-xs">練習：無限生命，可隨時結束</p>
             </div>

             <div className="mt-10 text-left bg-slate-900/85 p-6 rounded-lg border border-slate-600/60 text-sm text-slate-300 leading-relaxed shadow-xl">
                 <div className="flex items-center gap-2 mb-2 text-emerald-400 font-bold uppercase">
                    <Info size={16} /> 玩法說明
                 </div>
                 <ol className="list-decimal pl-5 space-y-2">
                     <li>按住 <strong className="text-white">空白鍵</strong> 或 <strong className="text-white">觸控</strong> 進入拔刀待機。</li>
                     <li>注意敵人的 <span className="text-red-500 font-bold">紅色閃擊</span>。</li>
                     <li>攻擊命中瞬間 <strong className="text-white">立刻放開</strong> 反擊。</li>
                     <li>太早放開＝落空；太晚＝受傷。</li>
                 </ol>
                 <p className="md:hidden text-emerald-400/90 text-xs mt-4 text-center">觸控：按住螢幕待機，放開即反擊</p>
             </div>
          </div>
        </div>
      )}

      {/* Only mount the arena while playing — avoids a black GameCanvas bleeding through the menu. */}
      {gameState !== GameState.MENU && (
        <GameCanvas
          key={gameState === GameState.PLAYING ? `playing-${playMode}` : 'over'}
          gameActive={gameState === GameState.PLAYING}
          playMode={playMode}
          onGameOver={handleGameOver}
        />
      )}

      {gameState === GameState.GAMEOVER && lastStats && (
        <ResultOverlay
          title={resultTitle}
          subtitle={
            isPractice
              ? '練習不計入個人最佳'
              : 'Perfect 窗：依難度收斂 · Good 窗：依難度收斂'
          }
          badge={
            isPractice
              ? '練習'
              : lastStats.score >= 10000
                ? '宗師'
                : lastStats.score >= 5000
                  ? '上級'
                  : '見習'
          }
          variant={resultVariant}
          stats={[
            { label: '總分', value: lastStats.score.toLocaleString() },
            { label: '最高連段', value: lastStats.maxCombo },
            { label: 'Perfect', value: lastStats.perfects },
            { label: 'Good', value: lastStats.goods },
            { label: '個人最佳分數', value: best.highScore.toLocaleString() },
            { label: '個人最高連段', value: best.maxCombo },
          ]}
          primaryLabel={isPractice ? '再練習' : '再挑戰一次'}
          onPrimary={() => startGame(playMode)}
        />
      )}
    </div>
  );
}
