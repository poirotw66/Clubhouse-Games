import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PlayerStance, EnemyState, CounterResult, GameStats, ProjectileType, PlayMode } from '../types';
import { 
  DURATION_SHURIKEN,
  DURATION_KUNAI,
  DURATION_BOMB,
  DURATION_SICKLE,
  HIT_STOP_DURATION,
  DAMAGE_PLAYER_HIT,
  DAMAGE_PLAYER_BLOCK,
  HEAL_PERFECT,
  SCORE_PERFECT,
  SCORE_GOOD,
  MAX_HP,
  INTENSITY_LABELS,
  getTimingWindows,
  getAttackDelayRange,
  getProjectileDurationScale,
  type PracticeIntensity,
} from '../constants';
import {
  playCapture,
  playError,
  playGoal,
  playMove,
  playScore,
} from '@clubhouse/shared/synthAudio';

/** User-facing hit feedback; CounterResult enum values stay English ids. */
const COUNTER_FEEDBACK_LABEL: Record<CounterResult, string> = {
  [CounterResult.NONE]: '',
  [CounterResult.PERFECT]: '完美',
  [CounterResult.GOOD]: '不錯',
  [CounterResult.EARLY]: '太早',
  [CounterResult.LATE]: '太晚',
  [CounterResult.MISS]: '失誤',
};

interface GameCanvasProps {
  onGameOver: (stats: GameStats) => void;
  gameActive: boolean;
  playMode: PlayMode;
  /** Practice intensity floor; challenge mode should stay 0. */
  baseTier?: PracticeIntensity;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  onGameOver,
  gameActive,
  playMode,
  baseTier = 0,
}) => {
  // --- Refs for Game Loop State ---
  const lastFrameTime = useRef<number>(0);
  const nextAttackTime = useRef<number>(0);
  const warningStartTime = useRef<number>(0); // When the enemy started winding up
  const impactTime = useRef<number>(0);
  const enemyState = useRef<EnemyState>(EnemyState.IDLE);
  const playerStance = useRef<PlayerStance>(PlayerStance.IDLE);
  const hitStopTimer = useRef<number>(0);
  const hp = useRef<number>(MAX_HP);
  const baseTierRef = useRef<PracticeIntensity>(baseTier);
  baseTierRef.current = baseTier;
  const isPractice = playMode === 'practice';
  
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
    const tier = baseTierRef.current;
    const delayRange = getAttackDelayRange(stats.current.score, tier);
    const delay =
      Math.random() * (delayRange.max - delayRange.min) + delayRange.min;
    nextAttackTime.current = now + delay;
    enemyState.current = EnemyState.IDLE;
    projectileProgress.current = 0;

    const durationScale = getProjectileDurationScale(stats.current.score, tier);

    // Randomize Projectile Type
    const rand = Math.random();
    if (rand < 0.4) {
      currentProjectileType.current = ProjectileType.SHURIKEN;
      currentProjectileDuration.current = DURATION_SHURIKEN * durationScale;
    } else if (rand < 0.65) {
      currentProjectileType.current = ProjectileType.KUNAI;
      currentProjectileDuration.current = DURATION_KUNAI * durationScale;
    } else if (rand < 0.85) {
      currentProjectileType.current = ProjectileType.BOMB;
      currentProjectileDuration.current = DURATION_BOMB * durationScale;
    } else {
      currentProjectileType.current = ProjectileType.SICKLE;
      currentProjectileDuration.current = DURATION_SICKLE * durationScale;
    }

  }, []);

  const takeDamage = useCallback((amount: number) => {
    hp.current = Math.max(0, hp.current - amount);
    if (hp.current <= 0) {
      if (isPractice) {
        // Infinite lives: refill and keep training.
        hp.current = MAX_HP;
        return;
      }
      onGameOver(stats.current);
    }
  }, [onGameOver, isPractice]);

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
    const windows = getTimingWindows(
      stats.current.score,
      stats.current.combo,
      baseTierRef.current,
    );

    if (absDiff <= windows.perfect) {
      result = CounterResult.PERFECT;
      playGoal();
      stats.current.score += SCORE_PERFECT + (stats.current.combo * 100);
      stats.current.combo++;
      stats.current.perfects++;
      hp.current = Math.min(MAX_HP, hp.current + HEAL_PERFECT);
      
      // FX
      setBgInvert(true);
      setTimeout(() => setBgInvert(false), 150);
      hitStopTimer.current = HIT_STOP_DURATION; 

    } else if (absDiff <= windows.good) {
      result = CounterResult.GOOD;
      playScore();
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
      playError();
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

    setFeedback({ text: COUNTER_FEEDBACK_LABEL[result], type: result });
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
    playMove();
  }, [gameActive]);

  const handlePointerUp = useCallback(() => {
    if (!gameActive || playerStance.current !== PlayerStance.SHEATHED) return;

    playerStance.current = PlayerStance.SLASHING;
    playCapture();

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
        const missWindow = getTimingWindows(
          stats.current.score,
          stats.current.combo,
          baseTierRef.current,
        ).good;
        if (time > impactTime.current + missWindow) {
            takeDamage(DAMAGE_PLAYER_HIT);
            stats.current.combo = 0;
            stats.current.misses++;
            setFeedback({ text: '命中', type: CounterResult.MISS });
            setScreenShake(true);
            setTimeout(() => setScreenShake(false), 300);
            playError();
            
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
            <div className="w-10 h-10 relative">
                <div className="absolute inset-0 bg-red-500 blur-md opacity-50"></div>
                <img
                  src={`${import.meta.env.BASE_URL}projectiles/shuriken.jpg`}
                  alt=""
                  className="w-full h-full object-contain drop-shadow"
                  draggable={false}
                />
            </div>
          )}

          {/* === KUNAI (Fast, Linear) === */}
          {type === ProjectileType.KUNAI && (
            <div className="w-14 h-14 relative">
                <div className="absolute inset-0 bg-blue-300 blur-sm opacity-35"></div>
                <img
                  src={`${import.meta.env.BASE_URL}projectiles/kunai.jpg`}
                  alt=""
                  className="w-full h-full object-contain drop-shadow"
                  draggable={false}
                />
            </div>
          )}

          {/* === BOMB (Slow, Arcing) === */}
          {type === ProjectileType.BOMB && (
            <div className="w-12 h-12 relative">
                <img
                  src={`${import.meta.env.BASE_URL}projectiles/bomb.jpg`}
                  alt=""
                  className="w-full h-full object-contain drop-shadow"
                  draggable={false}
                />
                <div className="absolute -top-1 right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse blur-[1px]"></div>
            </div>
          )}

          {/* === SICKLE (Wobbly, Wide) === */}
          {type === ProjectileType.SICKLE && (
            <div className="w-16 h-16 relative -translate-x-1/2 -translate-y-1/2">
                <div className="absolute inset-0 bg-purple-500/25 blur-md rounded-full"></div>
                <img
                  src={`${import.meta.env.BASE_URL}projectiles/sickle.jpg`}
                  alt=""
                  className="w-full h-full object-contain drop-shadow"
                  draggable={false}
                />
            </div>
          )}
      </div>
    );
  };

  // Background style — keep night dojo mood but stay readable (was #0a0a12 + slate-900 silhouettes = "broken assets")
  const containerClass = `relative w-full h-full overflow-hidden flex items-center justify-center transition-colors duration-75 touch-none ${
    bgInvert ? 'bg-slate-200 filter invert' : 'bg-[#1a2238]'
  } ${screenShake ? 'animate-shake' : ''}`;

  return (
    <div 
      className={containerClass}
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onTouchStart={(e) => { e.preventDefault(); handlePointerDown(); }}
      onTouchEnd={(e) => { e.preventDefault(); handlePointerUp(); }}
    >
      {/* Dynamic Background — dojo plate under readability wash */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-45"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}dojo-bg.jpg)` }}
        />
        <div className="w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-600/40 via-slate-900/50 to-slate-950/80"></div>
        <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-slate-950 to-transparent opacity-80"></div>
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-400/15 rounded-full blur-3xl"></div>
        <div className="absolute top-8 right-[18%] w-3 h-3 rounded-full bg-amber-100/80 shadow-[0_0_24px_8px_rgba(253,230,138,0.35)]"></div>
      </div>
      
      {/* Floor — dojo planks */}
      <div
        className="absolute bottom-0 w-full h-32 bg-cover bg-bottom border-t border-slate-500/20"
        style={{
          backgroundImage: [
            'linear-gradient(to top, rgba(12,16,28,0.92), rgba(12,16,28,0.35) 55%, transparent)',
            `url(${import.meta.env.BASE_URL}floor.jpg)`,
          ].join(', '),
        }}
      />

      {/* UI Layer */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-20">
        <div className="flex flex-col gap-2 pointer-events-none">
            <div className="flex items-center gap-2">
                <div className="w-64 h-6 bg-slate-800 border border-slate-600 skew-x-[-10deg] relative overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-300 ease-out ${hp.current < 30 ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-emerald-500 to-emerald-300'}`}
                        style={{ width: `${(hp.current / MAX_HP) * 100}%` }}
                    />
                </div>
                <span className={`font-display font-bold text-xl ${hp.current < 30 ? 'text-red-500' : 'text-emerald-400'}`}>
                    {Math.ceil(hp.current)}
                </span>
            </div>
            <div className="text-slate-500 text-xs font-display tracking-widest">
              {isPractice
                ? `練習 · ${INTENSITY_LABELS[baseTier]} · 無限生命`
                : 'HP // 體力'}
            </div>
        </div>

        <div className="text-right pointer-events-none">
            <div className="font-display text-5xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500">
                {stats.current.score.toLocaleString()}
            </div>
            {stats.current.combo > 1 && (
                <div className="text-amber-400 font-display font-bold text-2xl animate-bounce">
                    {stats.current.combo} 連段
                </div>
            )}
        </div>
      </div>

      {isPractice && gameActive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onGameOver(stats.current);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 px-5 py-2 rounded-lg bg-slate-800/90 border border-emerald-500/50 text-emerald-300 font-display text-sm tracking-wider hover:bg-slate-700 pointer-events-auto"
        >
          結束練習
        </button>
      )}

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
             <div className={`relative w-28 h-52 flex flex-col items-center transition-all duration-200 origin-bottom 
                 ${isSheathed ? 'scale-y-[0.92] translate-y-3 rotate-2' : ''}
                 ${isHit ? 'opacity-80' : ''}
             `}>
                <img
                  src={`${import.meta.env.BASE_URL}player.jpg`}
                  alt=""
                  draggable={false}
                  className={`w-full h-full object-contain drop-shadow-[0_8px_24px_rgba(16,185,129,0.35)] select-none ${
                    isSheathed ? 'brightness-110 contrast-110' : ''
                  }`}
                />

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
                    <span className="text-blue-400 font-display text-sm tracking-widest animate-pulse drop-shadow-md">集中…</span>
                ) : (
                    <span className="text-slate-400 text-xs font-display tracking-widest">按住空白鍵</span>
                )}
             </div>
        </div>

        {/* === RENDER PROJECTILES === */}
        {renderProjectile()}


        {/* === ENEMY (NINJA) === */}
        <div className="relative">
             <div className={`relative w-28 h-52 flex flex-col items-center transition-all duration-200 ${isEnemyAttacking ? 'translate-x-8 skew-x-6' : ''}`}>
                <img
                  src={`${import.meta.env.BASE_URL}enemy.jpg`}
                  alt=""
                  draggable={false}
                  className={`w-full h-full object-contain drop-shadow-[0_8px_24px_rgba(239,68,68,0.4)] select-none ${
                    isEnemyAttacking ? 'brightness-125 saturate-150' : ''
                  }`}
                />
                {isEnemyAttacking && (
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full shadow-[0_0_12px_red] animate-ping" />
                )}
                {/* Arm Throwing Animation State */}
                <div className={`absolute top-16 -left-2 w-20 h-3 bg-rose-900/90 origin-right transition-transform duration-100 border border-rose-700/40 rounded-full ${isEnemyAttacking ? 'rotate-[160deg]' : 'rotate-45'}`}>
                     <div className="absolute left-0 w-3.5 h-3.5 bg-rose-200 rounded-full -translate-y-0.5"></div>
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

    </div>
  );
};

export default GameCanvas;