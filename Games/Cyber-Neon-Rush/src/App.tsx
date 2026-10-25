import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactElement } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { JuiceSettingsPanel } from '@clubhouse/shared/JuiceSettings';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { haptic } from '@clubhouse/shared/juice';
import {
  playCapture,
  playError,
  playGoal,
  playLose,
  playMove,
  playScore,
  playWin,
} from '@clubhouse/shared/synthAudio';
import { GameCanvas } from './components/GameCanvas';
import { MetaHub } from './components/MetaHub';
import { Scoreboard } from './components/Scoreboard';
import { TouchControls } from './components/TouchControls';
import type { GameWorld, RunConfig } from './engine/GameWorld';
import {
  RUSH_DIFFICULTIES,
  RUSH_DIFFICULTY_LABELS,
  TIP_SEEN_KEY,
  type RushDifficulty,
} from './engine/constants';
import {
  buyCosmetic,
  buyUpgrade,
  claimMission,
  equipCosmetic,
  loadMeta,
  recordRunEnd,
  type CosmeticId,
  type MetaSave,
  type UpgradeId,
} from './engine/progress';
import { loadBests, type HudSnapshot, type RunResult } from './engine/scoreSystem';
import type { MenuPanel, Screen } from './types';

function hasSeenTip(): boolean {
  try {
    return localStorage.getItem(TIP_SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

function markTipSeen(): void {
  try {
    localStorage.setItem(TIP_SEEN_KEY, '1');
  } catch {
    /* private mode */
  }
}

const EMPTY_HUD: HudSnapshot = {
  score: 0,
  distance: 0,
  combo: 0,
  multiplier: 1,
  speed: 0,
  nearMissFlash: 0,
  bestScore: 0,
  bestDistance: 0,
  fever: false,
  boostT: 0,
  toast: null,
  pickups: 0,
  powerups: 0,
  dashCd: 0,
  dashReady: true,
  jumpAir: false,
  shake: 0,
  powers: { shield: false, magnet: 0, multiplier: 0, slowmo: 0 },
  scoreMulActive: 1,
};

export default function App(): ReactElement {
  const [screen, setScreen] = useState<Screen>('menu');
  const [panel, setPanel] = useState<MenuPanel>('none');
  const [difficulty, setDifficulty] = useState<RushDifficulty>('normal');
  const [meta, setMeta] = useState<MetaSave>(() => loadMeta());
  const [bests, setBests] = useState(() => loadBests());
  const modeBest = bests[difficulty];
  const [hud, setHud] = useState<HudSnapshot>(() => ({
    ...EMPTY_HUD,
    bestScore: modeBest.score,
    bestDistance: modeBest.distance,
  }));
  const [result, setResult] = useState<RunResult | null>(null);
  const [runId, setRunId] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const worldRef = useRef<GameWorld | null>(null);
  const toastRef = useRef<string | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const runConfig: RunConfig = useMemo(
    () => ({
      difficulty,
      upgrades: meta.upgrades,
      cosmeticId: meta.equippedCosmetic,
    }),
    [difficulty, meta.upgrades, meta.equippedCosmetic],
  );

  const onHud = useCallback((next: HudSnapshot) => {
    if (next.toast && next.toast !== toastRef.current) {
      if (next.toast === 'perfect' || next.toast === 'fever') playGoal();
      else if (next.toast === 'boost' || next.toast === 'dash') playCapture();
      else if (
        next.toast === 'shield' ||
        next.toast === 'magnet' ||
        next.toast === 'multiplier' ||
        next.toast === 'slowmo'
      ) {
        playCapture();
        playScore();
      } else if (next.toast === 'near') playScore();
      else playMove();
    }
    toastRef.current = next.toast;
    setHud(next);
  }, []);

  const onGameOver = useCallback((r: RunResult) => {
    setResult(r);
    setScreen('gameover');
    setShowTip(false);
    setBests(loadBests());
    setMeta((prev) =>
      recordRunEnd(prev, {
        score: r.score,
        distance: r.distance,
        avoids: r.avoids,
        perfects: r.perfects,
        pickups: r.pickups,
        powerups: r.powerups,
        dashes: r.dashes,
        reachedFever: r.reachedFever,
        creditsEarned: r.creditsEarned,
      }),
    );
    if (r.isNewBest || r.score >= 5000) {
      playWin();
      haptic('win');
    } else {
      playError();
      playLose();
      // Crash already pulsed impact/error in GameWorld; keep end soft.
    }
  }, []);

  const dismissTip = useCallback(() => {
    markTipSeen();
    setShowTip(false);
  }, []);

  const startRun = () => {
    setResult(null);
    setPanel('none');
    const b = loadBests()[difficulty];
    setHud({ ...EMPTY_HUD, bestScore: b.score, bestDistance: b.distance });
    setRunId((n) => n + 1);
    setScreen('playing');
    if (!hasSeenTip()) setShowTip(true);
  };

  const nudge = useCallback((dir: -1 | 1) => {
    worldRef.current?.nudgeLane(dir);
  }, []);

  const jump = useCallback(() => {
    worldRef.current?.jump();
  }, []);

  const dash = useCallback(() => {
    worldRef.current?.dash();
  }, []);

  const onSwipePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (screen !== 'playing') return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, [role="dialog"]')) return;
    swipeStart.current = { x: e.clientX, y: e.clientY };
  }, [screen]);

  const onSwipePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (swipeStart.current == null) return;
      const dx = e.clientX - swipeStart.current.x;
      const dy = e.clientY - swipeStart.current.y;
      swipeStart.current = null;
      if (Math.abs(dx) < 48 && Math.abs(dy) < 48) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        nudge(dx < 0 ? -1 : 1);
      } else if (dy < 0) {
        jump();
      } else {
        dash();
      }
    },
    [nudge, jump, dash],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (panel === 'howto' && e.code === 'Escape') {
        e.preventDefault();
        setPanel('none');
        return;
      }
      if (panel === 'meta' && e.code === 'Escape') {
        e.preventDefault();
        setPanel('none');
        return;
      }
      if (showTip && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) {
        e.preventDefault();
        dismissTip();
        return;
      }
      if (screen === 'menu' && panel === 'none' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        startRun();
        return;
      }
      if (screen === 'playing' || screen === 'paused') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          e.preventDefault();
          nudge(-1);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault();
          nudge(1);
        } else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
          e.preventDefault();
          jump();
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          e.preventDefault();
          dash();
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
          e.preventDefault();
          setScreen((s) => (s === 'paused' ? 'playing' : 'paused'));
        }
      }
      if (screen === 'gameover' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        startRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, nudge, jump, dash, panel, showTip, dismissTip, difficulty]);

  const handleBuyUpgrade = (id: UpgradeId) => {
    setMeta((prev) => {
      const next = buyUpgrade(prev, id);
      if (next) playScore();
      else playError();
      return next ?? prev;
    });
  };

  const handleBuyCosmetic = (id: CosmeticId) => {
    setMeta((prev) => {
      const next = buyCosmetic(prev, id);
      if (next) playGoal();
      else playError();
      return next ?? prev;
    });
  };

  const handleEquipCosmetic = (id: CosmeticId) => {
    setMeta((prev) => {
      const next = equipCosmetic(prev, id);
      if (next) playMove();
      return next ?? prev;
    });
  };

  const handleClaimMission = (id: string) => {
    setMeta((prev) => {
      const next = claimMission(prev, id);
      if (next.credits > prev.credits) playWin();
      return next;
    });
  };

  const showCanvas = screen !== 'menu';
  const showBoard = screen === 'playing' || screen === 'paused' || screen === 'gameover';
  const flashOpacity = Math.min(0.55, hud.nearMissFlash * 0.5);
  const shakeHard = hud.shake > 0.22;
  const shakeSoft = hud.shake > 0.06;
  const unclaimed = meta.missions.filter((m) => m.progress >= m.target && !m.claimed).length;

  return (
    <div
      className={`relative w-full h-dvh overflow-hidden select-none${shakeHard ? ' screen-shake-hard' : shakeSoft ? ' screen-shake' : ''}`}
      onPointerDown={onSwipePointerDown}
      onPointerUp={onSwipePointerUp}
      onPointerCancel={() => {
        swipeStart.current = null;
      }}
    >
      <BackToMenu />

      {showCanvas && (
        <GameCanvas
          key={runId}
          config={runConfig}
          running={screen === 'playing' || screen === 'paused' || screen === 'gameover'}
          paused={screen === 'paused' || screen === 'gameover'}
          onHud={onHud}
          onGameOver={onGameOver}
          worldRef={worldRef}
        />
      )}

      {showBoard && flashOpacity > 0.02 && (
        <div
          className={`feedback-vignette ${hud.fever ? 'is-fever' : ''} ${hud.toast === 'perfect' ? 'is-perfect' : ''}`}
          style={{ opacity: flashOpacity }}
          aria-hidden="true"
        />
      )}

      <Scoreboard hud={hud} visible={showBoard} />

      {screen === 'menu' && (
        <div className="menu-shell" data-ui="cyber-neon-start">
          <div className="menu-poster">
            <div className="menu-marquee" aria-hidden="true">
              <div className="menu-marquee-track">
                <span>霓虹疾馳 · CYBER NEON RUSH · 切道 · 跳躍 · 衝刺 · 擦身連擊 · 霓虹幣 ·</span>
                <span>霓虹疾馳 · CYBER NEON RUSH · 切道 · 跳躍 · 衝刺 · 擦身連擊 · 霓虹幣 ·</span>
              </div>
            </div>
            <div className="menu-waterline">
              <div className="menu-field-top" />
              <div className="menu-field-bottom" />
              <div className="menu-hero-copy">
                <p className="menu-brand-kicker">Clubhouse Arcade</p>
                <h1 className="menu-title-stack" aria-label="霓虹疾馳">
                  <span className="menu-title-line" aria-hidden="true">
                    <span>霓虹</span>
                  </span>
                  <span className="menu-title-line" aria-hidden="true">
                    <span>疾馳</span>
                  </span>
                </h1>
                <p className="menu-en">Cyber Neon Rush</p>
                <p className="menu-support">
                  三線霓虹賽道無限衝刺——切道、跳躍、衝刺讀障礙，擦身連擊把夜色點燃。
                </p>
              </div>
              <div className="menu-sticker" aria-hidden="true">
                <img
                  src={`${import.meta.env.BASE_URL}menu-bg.jpg`}
                  alt=""
                  width={640}
                  height={480}
                  decoding="async"
                />
              </div>
            </div>
            <div className="menu-actions">
              <div className="menu-actions-inner">
                <div className="mode-chips" role="group" aria-label="難度">
                  {RUSH_DIFFICULTIES.map((id) => {
                    const selected = difficulty === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`mode-chip${selected ? ' is-active' : ''}`}
                        aria-pressed={selected}
                        onClick={() => setDifficulty(id)}
                      >
                        {RUSH_DIFFICULTY_LABELS[id]}
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="cta" onClick={startRun}>
                  開始疾馳
                </button>
                <div className="menu-secondary-row">
                  <button type="button" className="cta-secondary" onClick={() => setPanel('meta')}>
                    車庫與任務{unclaimed > 0 ? `（${unclaimed}）` : ''}
                  </button>
                  <button type="button" className="cta-secondary" onClick={() => setPanel('howto')}>
                    操作教學
                  </button>
                </div>
                <p className="hint">
                  ←→ 切道・↑／空白鍵跳・↓／Shift 衝刺・P／Esc 暫停
                  <br />
                  {RUSH_DIFFICULTY_LABELS[difficulty]} ・ 最佳 {modeBest.score || '—'} ・ 最遠{' '}
                  {modeBest.distance || '—'} m ・ 幣 {meta.credits}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {panel === 'howto' && (
        <div
          className="howto-shell"
          role="dialog"
          aria-modal="true"
          aria-label="操作教學"
          onClick={() => setPanel('none')}
        >
          <div className="howto-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl neon-text mb-3">操作教學</h2>
            <ol className="howto-list">
              <li>
                <strong>切道</strong>
                ：← → / A D，或左右滑動／觸控左右鍵。
              </li>
              <li>
                <strong>跳躍</strong>
                ：↑ / W / 空白鍵，或上滑；可越過矮障與錐桶。
              </li>
              <li>
                <strong>衝刺</strong>
                ：↓ / S / Shift，或下滑；冷卻內無敵並鑽過橫桿，附帶爆發加速。
              </li>
              <li>
                <strong>道具</strong>
                ：護盾擋一次、磁鐵吸拾取、分數加倍、慢動作；與硝基加速環並存。
              </li>
              <li>
                <strong>擦身連擊</strong>
                ：貼近閃過加分並短暫提速；滿 5 進入狂熱。
              </li>
            </ol>
            <p className="hint" style={{ marginTop: '0.75rem' }}>
              暫停：P 或 Esc ・ 霓虹幣存於本機車庫
            </p>
            <button type="button" className="cta" onClick={() => setPanel('none')}>
              知道了
            </button>
          </div>
        </div>
      )}

      {panel === 'meta' && (
        <MetaHub
          meta={meta}
          onBuyUpgrade={handleBuyUpgrade}
          onBuyCosmetic={handleBuyCosmetic}
          onEquipCosmetic={handleEquipCosmetic}
          onClaimMission={handleClaimMission}
          onClose={() => setPanel('none')}
        />
      )}

      {screen === 'paused' && (
        <div className="menu-shell is-pause">
          <div className="menu-card">
            <h2 className="font-display text-3xl neon-text mb-2">暫停</h2>
            <p className="hint" style={{ color: '#94a3b8' }}>
              按 P 或 Esc 繼續
            </p>
            <div className="mb-4 text-left">
              <JuiceSettingsPanel compact />
            </div>
            <button type="button" className="cta" onClick={() => setScreen('playing')}>
              繼續疾馳
            </button>
          </div>
        </div>
      )}

      {showTip && screen === 'playing' && (
        <div className="run-tip" role="status">
          <p>
            矮障可<strong>跳</strong>、橫桿可<strong>衝</strong>；撿彩色道具強化跑酷。
            擦身而過可連擊並短暫加速。
          </p>
          <button type="button" className="run-tip-dismiss" onClick={dismissTip}>
            知道了
          </button>
        </div>
      )}

      <TouchControls
        visible={screen === 'playing'}
        onLeft={() => nudge(-1)}
        onRight={() => nudge(1)}
        onJump={jump}
        onDash={dash}
        dashReady={hud.dashReady}
      />

      {screen === 'gameover' && result && (
        <ResultOverlay
          title="衝撞出局"
          subtitle={
            result.isNewBest
              ? '新紀錄！霓虹幣已入庫，車庫等你升級。'
              : `本局賺取 ${result.creditsEarned} 霓虹幣。再來一趟，閃得更漂亮。`
          }
          badge={result.isNewBest ? '新紀錄' : undefined}
          variant={result.isNewBest ? 'win' : 'lose'}
          stats={[
            { label: '難度', value: RUSH_DIFFICULTY_LABELS[difficulty] },
            { label: '分數', value: result.score.toLocaleString('zh-Hant') },
            { label: '距離', value: `${result.distance} m` },
            { label: '閃避', value: String(result.avoids) },
            { label: '完美', value: String(result.perfects) },
            { label: '道具', value: String(result.powerups) },
            { label: '衝刺', value: String(result.dashes) },
            { label: '霓虹幣', value: `+${result.creditsEarned}` },
            { label: '最高連擊', value: String(result.maxCombo) },
          ]}
          primaryLabel="再試一次"
          onPrimary={startRun}
          secondaryLabel="車庫"
          onSecondary={() => {
            setScreen('menu');
            setPanel('meta');
          }}
        />
      )}
    </div>
  );
}
