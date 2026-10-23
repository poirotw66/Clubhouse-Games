/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { JuiceSettingsPanel } from '@clubhouse/shared/JuiceSettings';
import { haptic, type HapticPreset } from '@clubhouse/shared/juice';
import { playGoal, playLose, playWin } from '@clubhouse/shared/synthAudio';
import { createRoot } from 'react-dom/client';
import { DIFFICULTY, OPPONENTS, isOpponentUnlocked } from './src/game/opponents.js';
import { loadStats } from './src/game/scoring.js';
import {
  DAILY_BALL_COUNT,
  buildDailyShareText,
  computeDailyStreak,
  copyText,
  taipeiDateKey,
} from './src/game/daily.js';

const HAPTIC_PRESETS = new Set<HapticPreset>([
  'tap',
  'place',
  'success',
  'combo',
  'impact',
  'error',
  'win',
]);

function isHapticPreset(value: unknown): value is HapticPreset {
  return typeof value === 'string' && HAPTIC_PRESETS.has(value as HapticPreset);
}

type Mode = 'drill' | 'scoreAttack' | 'versus' | 'daily';
type Diff = 'easy' | 'normal' | 'hard';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    backgroundImage: [
      'linear-gradient(rgba(0,0,0,0.72), rgba(0,0,0,0.85))',
      `url(${import.meta.env.BASE_URL}menu-bg.jpg)`,
    ].join(', '),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    overflow: 'hidden',
    fontFamily: "'Teko', 'Noto Sans TC', 'Segoe UI', sans-serif",
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px 12px 130px',
    background: 'rgba(0,0,0,0.55)',
    zIndex: 20,
    borderBottom: '1px solid #222',
  },
  gameWrapper: {
    flex: 1,
    position: 'relative' as const,
    width: '100%',
    height: '100%',
    background: '#000',
    overflow: 'hidden',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
    backgroundColor: '#000',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
  },
  button: (active: boolean) => ({
    background: active ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
    color: active ? '#000000' : '#ffffff',
    border: '1px solid ' + (active ? '#ffffff' : 'rgba(255, 255, 255, 0.1)'),
    padding: '10px 16px',
    minHeight: 44,
    borderRadius: '100px',
    fontSize: '13px',
    fontWeight: '600' as const,
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    outline: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    touchAction: 'manipulation' as const,
  }),
  title: {
    color: '#fff',
    fontSize: '22px',
    fontWeight: '800',
    letterSpacing: '0.04em',
    marginRight: '20px',
  },
  modalOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto' as const,
    zIndex: 50,
    overflowY: 'auto' as const,
    padding: '24px 12px',
  },
  modal: {
    backgroundColor: '#111',
    backgroundImage: [
      'linear-gradient(rgba(17,17,17,0.88), rgba(10,28,18,0.92))',
      `url(${import.meta.env.BASE_URL}menu-bg.jpg)`,
    ].join(', '),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '24px',
    padding: '28px',
    width: '560px',
    maxWidth: '94%',
    color: '#fff',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    animation: 'fadeIn 0.2s ease-out',
  },
  modalHeader: {
    fontSize: '28px',
    fontWeight: '700' as const,
    marginBottom: '8px',
    background: 'linear-gradient(to right, #fff, #9fdfb8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: '0 0 8px 0',
  },
  modalSub: {
    color: '#888',
    marginBottom: '16px',
    fontSize: '14px',
    lineHeight: '1.5',
    marginTop: 0,
  },
  modeBtn: {
    flex: 1,
    padding: '14px',
    background: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    fontWeight: '700' as const,
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'transform 0.1s',
    minHeight: 48,
    touchAction: 'manipulation' as const,
  },
  loadingContainer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
    zIndex: 5,
  },
  loadingText: {
    color: '#666',
    fontSize: '14px',
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
    animation: 'pulse 1.5s infinite',
  },
};

function App() {
  const [showMenu, setShowMenu] = useState(true);
  const [handedness, setHandedness] = useState<'left' | 'right'>('right');
  const [muted, setMuted] = useState(false);
  const [difficulty, setDifficulty] = useState<Diff>('normal');
  const [mode, setMode] = useState<Mode>('drill');
  const [opponentId, setOpponentId] = useState('hao');
  const [isLoading, setIsLoading] = useState(true);
  const [statsTick, setStatsTick] = useState(0);
  const [shareNote, setShareNote] = useState('');
  const [lastDaily, setLastDaily] = useState<{
    dateKey: string;
    score: number;
    perfects: number;
    accuracy: number;
    streak: number;
  } | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const todayKey = taipeiDateKey();

  const stats = loadStats(
    (() => {
      try {
        return localStorage;
      } catch {
        return null;
      }
    })(),
  );
  void statsTick;

  const dailyBestToday = stats.dailyBest[todayKey];
  const dailyStreak = computeDailyStreak(stats.dailyBest, todayKey);

  const formatDrillBest = (balls: number): string => {
    const best = stats.drillBestAcc[`${difficulty}:${balls}`];
    return best == null ? '尚無紀錄' : `最佳 ${best}%`;
  };

  const formatScoreBest = (): string => {
    const best = stats.scoreAttackBest[difficulty];
    return best == null ? '尚無紀錄' : `最佳 ${best}`;
  };

  const startMatch = (payload: Record<string, unknown>) => {
    setShowMenu(false);
    setShareNote('');
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'START_MATCH', payload }, '*');
    }
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'PAUSE_GAME', payload: showMenu }, '*');
      iframe.contentWindow.postMessage({ type: 'SET_HANDEDNESS', payload: handedness }, '*');
      iframe.contentWindow.postMessage({ type: 'SET_MUTE', payload: muted }, '*');
    }
  }, [showMenu, handedness, muted, isLoading]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GAME_READY') setIsLoading(false);
      if (event.data?.type === 'JUICE_HAPTIC') {
        const preset = event.data.payload;
        if (isHapticPreset(preset)) haptic(preset);
        return;
      }
      if (event.data?.type === 'SHOW_MENU') {
        setShowMenu(true);
        setStatsTick((n) => n + 1);
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'PAUSE_GAME', payload: true }, '*');
        }
      }
      if (event.data?.type === 'DRILL_OVER') {
        const payload = event.data.payload ?? {};
        if (!muted) {
          const grade = String(payload.grade ?? '');
          if (grade === 'S' || grade === 'A') playWin();
          else if (grade === 'B') playGoal();
          else playLose();
        }
        setStatsTick((n) => n + 1);
        if (payload.mode === 'daily') {
          setLastDaily({
            dateKey: String(payload.dateKey || todayKey),
            score: Number(payload.score) || 0,
            perfects: Number(payload.perfects) || 0,
            accuracy: Number(payload.accuracy) || 0,
            streak: Number(payload.streak) || 0,
          });
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [muted, todayKey]);

  const handleIFrameLoad = () => {
    setIsLoading(false);
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'PAUSE_GAME', payload: showMenu }, '*');
      iframe.contentWindow.postMessage({ type: 'SET_HANDEDNESS', payload: handedness }, '*');
      iframe.contentWindow.postMessage({ type: 'SET_MUTE', payload: muted }, '*');
    }
  };

  const diffBtn = (id: Diff, label: string) => (
    <button
      type="button"
      key={id}
      style={{
        ...styles.modeBtn,
        flex: 1,
        fontSize: '16px',
        padding: '12px',
        background: difficulty === id ? '#fff' : 'rgba(255,255,255,0.08)',
        color: difficulty === id ? '#000' : '#ccc',
        border: difficulty === id ? 'none' : '1px solid rgba(255,255,255,0.15)',
      }}
      onClick={() => setDifficulty(id)}
    >
      {label}
    </button>
  );

  const modeTab = (id: Mode, label: string) => (
    <button
      type="button"
      key={id}
      style={{
        ...styles.modeBtn,
        background: mode === id ? '#c8f5d8' : 'rgba(255,255,255,0.08)',
        color: mode === id ? '#062010' : '#ddd',
        border: mode === id ? 'none' : '1px solid rgba(255,255,255,0.15)',
        fontSize: '14px',
        padding: '12px 8px',
      }}
      onClick={() => setMode(id)}
    >
      {label}
    </button>
  );

  const shareDaily = async () => {
    const source = lastDaily ?? {
      dateKey: todayKey,
      score: dailyBestToday ?? 0,
      perfects: 0,
      accuracy: 0,
      streak: dailyStreak,
    };
    if (!source.score && dailyBestToday == null) {
      setShareNote('先打完今日挑戰再分享');
      return;
    }
    const text = buildDailyShareText({
      dateKey: source.dateKey,
      score: source.score || dailyBestToday || 0,
      perfects: source.perfects,
      accuracy: source.accuracy,
      streak: source.streak || dailyStreak,
    });
    const ok = await copyText(text);
    setShareNote(ok ? '已複製分享文字' : '複製失敗，請手動選取');
  };

  return (
    <div style={styles.container}>
      <BackToMenu />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Teko:wght@500;700&family=Noto+Sans+TC:wght@400;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
      `}</style>

      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={styles.title}>羽毛球接殺</div>
        </div>

        <div style={styles.buttonGroup}>
          <button type="button" style={styles.button(false)} onClick={() => setMuted((m) => !m)}>
            {muted ? '靜音' : '音效'}
          </button>
          <div style={{ width: 1, height: 20, background: '#333', margin: '0 8px' }} />
          <button
            type="button"
            style={styles.button(false)}
            onClick={() => setHandedness((h) => (h === 'left' ? 'right' : 'left'))}
          >
            {handedness === 'left' ? '左手' : '右手'}
          </button>
        </div>
      </div>

      <div style={styles.gameWrapper}>
        {isLoading && (
          <div style={styles.loadingContainer}>
            <div style={styles.loadingText}>載入球場…</div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={`${import.meta.env.BASE_URL}game.html`}
          style={{ ...styles.iframe, visibility: isLoading ? 'hidden' : 'visible' }}
          title="Game Canvas"
          sandbox="allow-scripts allow-pointer-lock allow-same-origin allow-forms"
          onLoad={handleIFrameLoad}
        />
      </div>

      {showMenu && (
        <div
          style={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="smash-start-title"
        >
          <div style={styles.modal}>
            <h2 id="smash-start-title" style={styles.modalHeader}>
              羽毛球接殺
            </h2>
            <p style={{ ...styles.modalSub, color: '#ccc' }}>
              讀對手預備動作與假動作，卡進時機窗揮拍。完美擋後進入回殺，選擇落點得分或打亂節奏。
            </p>

            <p style={{ margin: '0 0 8px', color: '#aaa', fontSize: 13 }}>模式</p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginBottom: 16,
              }}
            >
              {modeTab('drill', '訓練')}
              {modeTab('scoreAttack', '得分挑戰')}
              {modeTab('versus', '對戰階梯')}
              {modeTab('daily', '每日挑戰')}
            </div>

            {mode !== 'versus' && mode !== 'daily' && (
              <>
                <p style={{ margin: '0 0 8px', color: '#aaa', fontSize: 13 }}>難度</p>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  {diffBtn('easy', DIFFICULTY.easy.label)}
                  {diffBtn('normal', DIFFICULTY.normal.label)}
                  {diffBtn('hard', DIFFICULTY.hard.label)}
                </div>
              </>
            )}

            {mode === 'drill' && (
              <>
                <p style={{ margin: '0 0 8px', color: '#aaa', fontSize: 13 }}>球數（熱身→加壓→混戰）</p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {([10, 25, 50] as const).map((count) => (
                    <button
                      key={count}
                      type="button"
                      style={{
                        ...styles.modeBtn,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      onClick={() =>
                        startMatch({ mode: 'drill', balls: count, difficulty })
                      }
                    >
                      <span>{count} 球</span>
                      <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 500 }}>
                        {formatDrillBest(count)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {mode === 'scoreAttack' && (
              <div>
                <p style={{ margin: '0 0 12px', color: '#bbb', fontSize: 14 }}>
                  波次加壓、生命耗盡為止。完美回殺可額外得分。{formatScoreBest()}
                </p>
                <button
                  type="button"
                  style={{ ...styles.modeBtn, width: '100%' }}
                  onClick={() => startMatch({ mode: 'scoreAttack', difficulty })}
                >
                  開始挑戰
                </button>
              </div>
            )}

            {mode === 'versus' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                <p style={{ margin: '0 0 4px', color: '#bbb', fontSize: 13 }}>
                  BO3 系列賽：打贏解鎖下一位。每位有招牌習慣。
                </p>
                {OPPONENTS.map((opp) => {
                  const unlocked = isOpponentUnlocked(stats.versusWins, opp);
                  const wins = stats.versusWins[opp.id] ?? 0;
                  const selected = opponentId === opp.id;
                  return (
                    <button
                      key={opp.id}
                      type="button"
                      disabled={!unlocked}
                      style={{
                        ...styles.modeBtn,
                        textAlign: 'left',
                        background: !unlocked
                          ? 'rgba(255,255,255,0.04)'
                          : selected
                            ? '#c8f5d8'
                            : 'rgba(255,255,255,0.08)',
                        color: !unlocked ? '#666' : selected ? '#062010' : '#eee',
                        border: selected ? 'none' : '1px solid rgba(255,255,255,0.12)',
                        cursor: unlocked ? 'pointer' : 'not-allowed',
                        padding: '12px 14px',
                      }}
                      onClick={() => unlocked && setOpponentId(opp.id)}
                    >
                      <div style={{ fontSize: 17 }}>{unlocked ? opp.name : '???（未解鎖）'}</div>
                      <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 500, marginTop: 2 }}>
                        {unlocked
                          ? `${opp.habit.label} · ${opp.tagline} · 先至 ${opp.pointsToWin} · 勝 ${wins}`
                          : '先擊敗前一位對手'}
                      </div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  style={{ ...styles.modeBtn, width: '100%', marginTop: 4 }}
                  onClick={() =>
                    startMatch({ mode: 'versus', opponentId, difficulty: 'normal' })
                  }
                  disabled={!isOpponentUnlocked(stats.versusWins, OPPONENTS.find((o) => o.id === opponentId)!)}
                >
                  BO3 挑戰「{OPPONENTS.find((o) => o.id === opponentId)?.name ?? ''}」
                </button>
              </div>
            )}

            {mode === 'daily' && (
              <div>
                <p style={{ margin: '0 0 8px', color: '#bbb', fontSize: 14 }}>
                  台北日曆 {todayKey} · 固定 {DAILY_BALL_COUNT} 球腳本（含假動作）
                </p>
                <p style={{ margin: '0 0 12px', color: '#9fdfb8', fontSize: 14 }}>
                  今日最佳 {dailyBestToday == null ? '尚無' : dailyBestToday} · 連續{' '}
                  {dailyStreak} 天
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    style={{ ...styles.modeBtn, flex: 1, minWidth: 140 }}
                    onClick={() =>
                      startMatch({ mode: 'daily', dateKey: todayKey, balls: DAILY_BALL_COUNT })
                    }
                  >
                    開始今日挑戰
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.modeBtn,
                      flex: 1,
                      minWidth: 140,
                      background: 'rgba(255,255,255,0.1)',
                      color: '#eee',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                    onClick={() => void shareDaily()}
                  >
                    複製分享文字
                  </button>
                </div>
                {shareNote ? (
                  <p style={{ margin: '10px 0 0', color: '#ffe566', fontSize: 13 }}>{shareNote}</p>
                ) : null}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <JuiceSettingsPanel />
            </div>

            <p style={{ margin: '16px 0 0', color: '#777', fontSize: 12 }}>
              生涯完美 {stats.careerPerfects} · 回殺 {stats.careerCounters} · 最高連擋{' '}
              {stats.careerMaxCombo} · 場次 {stats.careerPlays}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root') || document.body);
root.render(<App />);
