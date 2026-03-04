import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, PlayerStance, EnemyState, CounterResult, GameStats, ProjectileType } from '../types';
import { 
  WARNING_DURATION_MIN, 
  WARNING_DURATION_MAX, 
  DURATION_SHURIKEN,
  DURATION_KUNAI,
  DURATION_BOMB,
  DURATION_SICKLE,
  WINDOW_PERFECT, 
  WINDOW_GOOD,
  HIT_STOP_DURATION,
  DAMAGE_PLAYER_HIT,
  DAMAGE_PLAYER_BLOCK,
  HEAL_PERFECT,
  SCORE_PERFECT,
  SCORE_GOOD
} from '../constants';
import { audioController } from '../services/audioService';

interface GameCanvasProps {
  onGameOver: (stats: GameStats) => void;
  gameActive: boolean;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ onGameOver, gameActive }) => {
  // --- Refs for Game Loop State ---
  const lastFrameTime = useRef<number>(0);
  const nextAttackTime = useRef<number>(0);
  const warningStartTime = useRef<number>(0); // When the enemy started winding up
  const impactTime = useRef<number>(0);
  const enemyState = useRef<EnemyState>(EnemyState.IDLE);
  const playerStance = useRef<PlayerStance>(PlayerStance.IDLE);
  const hitStopTimer = useRef<number>(0);
  const hp = useRef<number>(100);
  
  // Projectile State
  const currentProjectileType = useRef<ProjectileType>(ProjectileType.SHURIKEN);
  const currentProjectileDuration = useRef<number>(DURATION_SHURIKEN);
  const projectileProgress = useRef<number>(0); // 0 to 1

  // --- React State for Rendering ---
  const [renderTrigger, setRenderTrigger] = useState(0); 
  const [feedback, setFeedback] = useState<{ text: string, type: CounterResult } | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const [bgInvert, setBgInvert] = useState(false);
  
  // Stats
  const stats = useRef<GameStats>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfects: 0,
    goods: 0,
    misses: 0,
    history: []
  });

  // --- Helpers ---

  const scheduleNextAttack = useCallback(() => {
    const now = performance.now();
    const delay = Math.random() * (WARNING_DURATION_MAX - WARNING_DURATION_MIN) + WARNING_DURATION_MIN;
    nextAttackTime.current = now + delay;
    enemyState.current = EnemyState.IDLE;
    projectileProgress.current = 0;

    // Randomize Projectile Type
    const rand = Math.random();
    if (rand < 0.4) {
      currentProjectileType.current = ProjectileType.SHURIKEN;
      currentProjectileDuration.current = DURATION_SHURIKEN;
    } else if (rand < 0.65) {
      currentProjectileType.current = ProjectileType.KUNAI;
      currentProjectileDuration.current = DURATION_KUNAI;
    } else if (rand < 0.85) {
      currentProjectileType.current = ProjectileType.BOMB;
      currentProjectileDuration.current = DURATION_BOMB;
    } else {
      currentProjectileType.current = ProjectileType.SICKLE;
      currentProjectileDuration.current = DURATION_SICKLE;
    }

  }, []);

  const takeDamage = useCallback((amount: number) => {
    hp.current = Math.max(0, hp.current - amount);
    if (hp.current <= 0) {
      onGameOver(stats.current);
    }
  }, [onGameOver]);

  const triggerHitAnimation = useCallback(() => {
    playerStance.current = PlayerStance.HIT;
    // Reset to IDLE after animation (500ms)
    setTimeout(() => {
        if(hp.current > 0 && playerStance.current === PlayerStance.HIT) {
            playerStance.current = PlayerStance.IDLE;
        }
    }, 500);
  }, []);

  const handleCounter = useCallback((diff: number) => {
    const absDiff = Math.abs(diff);
    let result = CounterResult.MISS;

    if (absDiff <= WINDOW_PERFECT) {
      result = CounterResult.PERFECT;
      audioController.playPerfectCounter();
      stats.current.score += SCORE_PERFECT + (stats.current.combo * 100);
      stats.current.combo++;
      stats.current.perfects++;
      hp.current = Math.min(100, hp.current + HEAL_PERFECT);
      
      // FX
      setBgInvert(true);
      setTimeout(() => setBgInvert(false), 150);
      hitStopTimer.current = HIT_STOP_DURATION; 

    } else if (absDiff <= WINDOW_GOOD) {
      result = CounterResult.GOOD;
      audioController.playGoodCounter();
      stats.current.score += SCORE_GOOD + (stats.current.combo * 10);
      stats.current.combo++;
      stats.current.goods++;
      takeDamage(DAMAGE_PLAYER_BLOCK); 
      hitStopTimer.current = HIT_STOP_DURATION / 2;

    } else {
      result = CounterResult.LATE;
      stats.current.combo = 0;
      stats.current.misses++;
      takeDamage(DAMAGE_PLAYER_HIT);
      audioController.playDamage();
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 300);
      
      triggerHitAnimation();
    }

    stats.current.maxCombo = Math.max(stats.current.maxCombo, stats.current.combo);
    stats.current.history.push({
      id: Date.now(),
      timing: diff,
      result
    });

    setFeedback({ text: result, type: result });
    setTimeout(() => setFeedback(null), 800);

    // Reset Enemy
    scheduleNextAttack();
  }, [scheduleNextAttack, takeDamage, triggerHitAnimation]);

  // --- Input Handling ---

  const handlePointerDown = useCallback(() => {
    if (!gameActive || hp.current <= 0) return;
    // Prevent input if we are currently in HIT stun or already Recovering
    if (playerStance.current === PlayerStance.HIT || playerStance.current === PlayerStance.RECOVERING) return;
    // If we are slashing, we can't instantly sheathe again unless animation is done (simplified here)
    if (playerStance.current === PlayerStance.SLASHING) return;

    playerStance.current = PlayerStance.SHEATHED;
    audioController.playSheathe();
  }, [gameActive]);

  const handlePointerUp = useCallback(() => {
    if (!gameActive || playerStance.current !== PlayerStance.SHEATHED) return;

    playerStance.current = PlayerStance.SLASHING;
    audioController.playSlash();

    const now = performance.now();
    
    if (enemyState.current === EnemyState.WARNING || enemyState.current === EnemyState.ATTACKING) {
      const diff = now - impactTime.current; 
      handleCounter(diff);
    } else {
      handleCounter(-999); // Early miss
    }
    
    setTimeout(() => {
        // Only go back to IDLE if we aren't currently stunned/hit
        if(hp.current > 0 && playerStance.current !== PlayerStance.HIT) {
             playerStance.current = PlayerStance.IDLE;
        }
    }, 300);

  }, [gameActive, handleCounter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) handlePointerDown();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') handlePointerUp();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handlePointerDown, handlePointerUp]);


  // --- Game Loop ---

  useEffect(() => {
    if (!gameActive) return;

    scheduleNextAttack();
    lastFrameTime.current = performance.now();

    let requestAnimationFrameId: number;

    const loop = (time: number) => {
      const deltaTime = time - lastFrameTime.current;
      lastFrameTime.current = time;

      if (hitStopTimer.current > 0) {
        hitStopTimer.current -= deltaTime;
        requestAnimationFrameId = requestAnimationFrame(loop);
        return;
      }

      // Logic
      if (enemyState.current === EnemyState.IDLE) {
        projectileProgress.current = 0;
        if (time >= nextAttackTime.current) {
            enemyState.current = EnemyState.WARNING;
            warningStartTime.current = time;
            impactTime.current = time + currentProjectileDuration.current;
        }
      } else if (enemyState.current === EnemyState.WARNING || enemyState.current === EnemyState.ATTACKING) {
        
        // Calculate projectile progress (0 to 1) based on DYNAMIC duration
        const progress = (time - warningStartTime.current) / currentProjectileDuration.current;
        projectileProgress.current = Math.min(progress, 1.2); 

        if (time >= impactTime.current) {
            enemyState.current = EnemyState.ATTACKING;
        }
        
        // Miss condition (Late - Player did nothing)
        if (time > impactTime.current + WINDOW_GOOD) {
            takeDamage(DAMAGE_PLAYER_HIT);
            stats.current.combo = 0;
            stats.current.misses++;
            setFeedback({ text: 'HIT', type: CounterResult.MISS });
            setScreenShake(true);
            setTimeout(() => setScreenShake(false), 300);
            audioController.playDamage();
            
            triggerHitAnimation();
            scheduleNextAttack();
        }
      }

      setRenderTrigger(prev => prev + 1);
      requestAnimationFrameId = requestAnimationFrame(loop);
    };

    requestAnimationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestAnimationFrameId);
  }, [gameActive, scheduleNextAttack, takeDamage, triggerHitAnimation]);

  // --- Visual Helpers ---
  const isSheathed = playerStance.current === PlayerStance.SHEATHED;
  const isSlashing = playerStance.current === PlayerStance.SLASHING;
  const isHit = playerStance.current === PlayerStance.HIT;
  const isEnemyAttacking = enemyState.current === EnemyState.WARNING || enemyState.current === EnemyState.ATTACKING;

  // Render Projectile Helper
  const renderProjectile = () => {
    if (!isEnemyAttacking) return null;

    const progress = projectileProgress.current;
    const type = currentProjectileType.current;

    // Base position interpolation
    // left: calc(90% - (progress * 80%)) -> Moves from 90% right to 10% left
    const leftPos = 90 - (progress * 80);
    
    // Y-Offset variations per weapon
    let topOffset = 0; 
    let rotation = progress * 1000; // default fast spin

    if (type === ProjectileType.BOMB) {
      topOffset = -Math.sin(progress * Math.PI) * 100;
      rotation = progress * 360; // slower roll
    } else if (type === ProjectileType.SICKLE) {
      topOffset = Math.sin(progress * 15) * 40;
    }

    return (
      <div 
          className="absolute z-30 pointer-events-none"
          style={{ 
              left: `${leftPos}%`,
              top: `calc(50% + ${topOffset}px)`,
              transform: type === ProjectileType.KUNAI ? `rotate(180deg)` : `rotate(${rotation}deg)` 
          }}
      >
          {/* === SHURIKEN (Standard) === */}
          {type === ProjectileType.SHURIKEN && (
            <div className="w-8 h-8 relative">
                <div className="absolute inset-0 bg-red-500 blur-md opacity-60"></div>
                <div className="absolute inset-0 bg-white rotate-45 scale-50"></div>
                <div className="absolute inset-0 bg-slate-200 clip-path-shuriken"></div>
                {/* Trail */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-32 h-1 bg-gradient-to-l from-red-500/0 to-red-500/50 blur-sm transform translate-x-full rotate-[calc(-1*var(--tw-rotate))] origin-left"></div>
            </div>
          )}

          {/* === KUNAI (Fast, Linear) === */}
          {type === ProjectileType.KUNAI && (
            <div className="w-12 h-3 relative">
                <div className="absolute inset-0 bg-blue-300 blur-sm opacity-40"></div>
                <div className="w-full h-full bg-slate-200 clip-path-kunai"></div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-48 h-0.5 bg-gradient-to-l from-white/0 to-white/50 blur-sm transform translate-x-full"></div>
            </div>
          )}

          {/* === BOMB (Slow, Arcing) === */}
          {type === ProjectileType.BOMB && (
            <div className="w-10 h-10 relative">
                <div className="absolute inset-0 bg-black rounded-full shadow-lg"></div>
                {/* Fuse */}
                <div className="absolute -top-2 right-2 w-3 h-3 bg-orange-500 rounded-full animate-pulse blur-[1px]"></div>
                {/* Shine */}
                <div className="absolute top-2 left-2 w-3 h-3 bg-white/20 rounded-full"></div>
                {/* Skull Mark */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50 text-[10px] font-bold">☠</div>
            </div>
          )}

          {/* === SICKLE (Wobbly, Wide) === */}
          {type === ProjectileType.SICKLE && (
            <div className="w-16 h-16 relative -translate-x-1/2 -translate-y-1/2">
                <div className="absolute inset-0 border-4 border-slate-300 rounded-full border-r-transparent border-b-transparent transform rotate-45"></div>
                <div className="absolute inset-2 border-4 border-slate-500 rounded-full border-l-transparent border-t-transparent opacity-50"></div>
                <div className="absolute inset-0 bg-purple-500/20 blur-md rounded-full"></div>
            </div>
          )}
      </div>
    );
  };

  // Background style
  const containerClass = `relative w-full h-full overflow-hidden flex items-center justify-center transition-colors duration-75 touch-none ${
    bgInvert ? 'bg-slate-200 filter invert' : 'bg-[#0a0a12]'
  } ${screenShake ? 'animate-shake' : ''}`;

  return (
    <div 
      className={containerClass}
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onTouchStart={(e) => { e.preventDefault(); handlePointerDown(); }}
      onTouchEnd={(e) => { e.preventDefault(); handlePointerUp(); }}
    >
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-gray-900 to-black"></div>
        <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-black to-transparent opacity-80"></div>
        {/* Moon/Sun */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-64 h-64 bg-red-900/20 rounded-full blur-3xl"></div>
      </div>
      
      {/* Floor */}
      <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-black to-slate-900/50 border-t border-slate-800/30"></div>

      {/* UI Layer */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none z-20">
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <div className="w-64 h-6 bg-slate-800 border border-slate-600 skew-x-[-10deg] relative overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-300 ease-out ${hp.current < 30 ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-emerald-500 to-emerald-300'}`}
                        style={{ width: `${hp.current}%` }}
                    />
                </div>
                <span className={`font-display font-bold text-xl ${hp.current < 30 ? 'text-red-500' : 'text-emerald-400'}`}>
                    {Math.ceil(hp.current)}
                </span>
            </div>
            <div className="text-slate-500 text-xs font-display tracking-widest">HP // VITALITY</div>
        </div>

        <div className="text-right">
            <div className="font-display text-5xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500">
                {stats.current.score.toLocaleString()}
            </div>
            {stats.current.combo > 1 && (
                <div className="text-amber-400 font-display font-bold text-2xl animate-bounce">
                    {stats.current.combo} CHAIN
                </div>
            )}
        </div>
      </div>

      {/* GAME WORLD */}
      <div className="relative w-full max-w-5xl h-[500px] flex items-end justify-between px-16 pb-24 pointer-events-none z-10">
        
        {/* === PLAYER (SAMURAI) === */}
        <div className={`relative group transition-all duration-75 
            ${isSlashing ? 'translate-x-48' : ''} 
            ${isHit ? 'animate-hit grayscale sepia text-red-500' : ''}
        `}>
             
             {/* Hit Splash Effect */}
             {isHit && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-500/50 blur-3xl rounded-full z-0 animate-ping"></div>
             )}

             {/* Player Silhouette Container */}
             <div className={`relative w-24 h-48 flex flex-col items-center transition-all duration-200 origin-bottom 
                 ${isSheathed ? 'scale-y-[0.85] translate-y-6 rotate-3' : ''}
                 ${isHit ? 'opacity-80' : ''}
             `}>
                
                {/* Head */}
                <div className="w-10 h-10 bg-slate-900 rounded-full z-20 relative">
                    {/* Headband/Ties */}
                    <div className={`absolute top-2 -left-8 w-12 h-2 bg-slate-800 rounded-full origin-right transition-transform duration-500 ${isSheathed ? 'rotate-12' : '-rotate-6'}`}></div>
                    <div className="absolute top-2 -left-6 w-10 h-1 bg-slate-700 rounded-full origin-right rotate-12 opacity-50"></div>
                </div>

                {/* Torso */}
                <div className="w-16 h-20 bg-slate-800 -mt-2 z-10 rounded-sm flex justify-center relative">
                    {/* Scarf/Armor Detail */}
                    <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-800 opacity-50"></div>
                    {isSheathed && <div className="absolute top-4 w-full h-1 bg-blue-500/30 blur-sm"></div>} {/* Focus glint */}
                </div>

                {/* Hakama (Pants) */}
                <div className="w-24 h-24 bg-slate-900 -mt-2 clip-path-hakama relative">
                     <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-black opacity-80"></div>
                </div>
                
                {/* Arms / Sword */}
                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-32 h-32 pointer-events-none">
                     {/* Sword Handle */}
                     <div className={`absolute left-0 top-10 w-20 h-2 bg-slate-950 origin-right transition-all duration-100 ${isSheathed ? 'rotate-[-20deg] translate-x-2' : 'rotate-[120deg] -translate-y-10 translate-x-10 opacity-0'}`}></div>
                     {/* Hand */}
                     <div className={`absolute left-4 top-10 w-4 h-4 bg-slate-400 rounded-full ${isSheathed ? 'translate-y-1' : ''}`}></div>
                </div>

                {/* Sword Flash Effect (SVG) */}
                {isSlashing && (
                    <div className="absolute top-0 left-0 w-[400px] h-[300px] -translate-y-32 -translate-x-10 z-50">
                         <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">
                             <path d="M 10 90 Q 50 10 90 20" stroke="white" strokeWidth="2" fill="none" className="animate-slash-path" />
                             <path d="M 10 90 Q 50 10 90 20" stroke="#60a5fa" strokeWidth="8" fill="none" opacity="0.5" className="animate-slash-path" />
                         </svg>
                    </div>
                )}
             </div>

             {/* Ground Shadow */}
             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/50 blur-md rounded-full scale-y-50"></div>

             {/* Prompt */}
             <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-40 text-center">
                {isSheathed ? (
                    <span className="text-blue-400 font-display text-sm tracking-widest animate-pulse drop-shadow-md">FOCUS...</span>
                ) : (
                    <span className="text-slate-600 text-xs font-display tracking-widest">HOLD SPACE</span>
                )}
             </div>
        </div>

        {/* === RENDER PROJECTILES === */}
        {renderProjectile()}


        {/* === ENEMY (NINJA) === */}
        <div className="relative">
             <div className={`relative w-24 h-48 flex flex-col items-center transition-all duration-200 ${isEnemyAttacking ? 'translate-x-10 skew-x-12' : ''}`}>
                
                {/* Head / Hood */}
                <div className="w-10 h-10 bg-slate-900 rounded-full z-20 relative shadow-lg">
                    {/* Red Eye (The visual tell is primarily the projectile now, but the eye helps locate the enemy) */}
                    {isEnemyAttacking && <div className="absolute top-3 left-2 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_red] animate-ping"></div>}
                </div>

                {/* Body */}
                <div className="w-14 h-24 bg-slate-800 -mt-2 z-10 rounded-sm flex justify-center">
                    {/* Mesh Armor Pattern */}
                    <div className="w-full h-full opacity-10 bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:4px_4px]"></div>
                </div>

                {/* Legs */}
                <div className="flex w-full justify-between px-2 -mt-2">
                    <div className="w-4 h-20 bg-slate-900 -rotate-3 rounded-b-lg"></div>
                    <div className="w-4 h-20 bg-slate-900 rotate-3 rounded-b-lg"></div>
                </div>

                {/* Arm Throwing Animation State */}
                <div className={`absolute top-8 -left-4 w-20 h-4 bg-slate-900 origin-right transition-transform duration-100 ${isEnemyAttacking ? 'rotate-[160deg]' : 'rotate-45'}`}>
                     {/* Hand */}
                     <div className="absolute left-0 w-4 h-4 bg-slate-500 rounded-full"></div>
                </div>
             </div>
             
             {/* Ground Shadow */}
             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-4 bg-black/50 blur-md rounded-full scale-y-50"></div>
        </div>


        {/* === FEEDBACK TEXT === */}
        {feedback && (
           <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center pointer-events-none z-50 mix-blend-screen">
               <h2 className={`font-display text-8xl font-black italic tracking-tighter scale-150 transition-all duration-75 
                 ${feedback.type === CounterResult.PERFECT ? 'text-white drop-shadow-[0_0_10px_#3b82f6] scale-[2]' : ''}
                 ${feedback.type === CounterResult.GOOD ? 'text-amber-300' : ''}
                 ${(feedback.type === CounterResult.MISS || feedback.type === CounterResult.LATE) ? 'text-red-600 shake' : ''}
               `}>
                   {feedback.text}
               </h2>
           </div>
        )}

      </div>

      <style>{`
        .clip-path-hakama {
            clip-path: polygon(10% 0, 90% 0, 100% 100%, 0% 100%);
        }
        .clip-path-shuriken {
            clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
        }
        .clip-path-kunai {
            clip-path: polygon(0 40%, 70% 40%, 100% 50%, 70% 60%, 0 60%);
        }
        .animate-spin-fast {
            animation: spin 0.2s linear infinite;
        }
        .animate-slash-path {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: slash 0.1s linear forwards;
        }
        
        /* Hit Animation */
        @keyframes hit-shake {
          0% { transform: translateX(0) rotate(0); }
          15% { transform: translateX(-15px) rotate(-10deg) skewX(-10deg); filter: brightness(2) sepia(1) hue-rotate(-50deg) saturate(5); }
          30% { transform: translateX(10px) rotate(5deg) skewX(5deg); }
          45% { transform: translateX(-10px) rotate(-5deg); filter: none; opacity: 0.5; }
          60% { transform: translateX(5px) rotate(2deg); }
          75% { transform: translateX(-2px); opacity: 1; }
          100% { transform: translateX(0) rotate(0); }
        }
        .animate-hit {
          animation: hit-shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @keyframes slash {
            to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
};

export default GameCanvas;