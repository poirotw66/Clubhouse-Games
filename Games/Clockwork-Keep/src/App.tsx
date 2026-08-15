import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { playCard, playError, playLose, playMove, playWin } from '@clubhouse/shared/synthAudio';
import { Battlefield } from './components/Battlefield';
import {
  BEST_SCORE_KEY_PREFIX,
  BEST_TIME_KEY_PREFIX,
  BEST_WAVE_KEY_PREFIX,
  DIFFICULTIES,
  FIXED_DT,
  MAP_ROCKS,
  TOTAL_WAVES,
  TOWER_DEFS,
  type Difficulty,
  type MapId,
  type TowerType,
} from './game/constants';
import { purchaseCost, sellRefund, upgradeCost } from './game/economy';
import {
  createInitialState,
  placeTower,
  sellTower,
  startNextWave,
  step,
  undoLast,
  upgradeTower,
  withRocks,
  type CommandResult,
} from './game/engine';
import type { Cell, GameState } from './game/types';

const TOWER_ORDER: TowerType[] = ['crossbow', 'grinder', 'frost', 'coil'];
const TOWER_HOTKEYS: Record<string, TowerType> = { '1': 'crossbow', '2': 'grinder', '3': 'frost', '4': 'coil' };

const DIFFICULTY_LABELS: Record<Difficulty, string> = { relaxed: '悠閒', standard: '標準', harsh: '嚴苛' };
const MAP_LABELS: Record<MapId, string> = { open: '開闊', corridor: '窄廊' };

function readStoredNumber(key: string): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeStoredNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* private mode / storage disabled */
  }
}

type Screen = 'setup' | 'playing';

export default function App(): ReactElement {
  const [screen, setScreen] = useState<Screen>('setup');
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [mapId, setMapId] = useState<MapId>('open');
  const [endless, setEndless] = useState(false);

  const [state, setState] = useState<GameState | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const [selectedTowerType, setSelectedTowerType] = useState<TowerType | null>(null);
  const [selectedTowerId, setSelectedTowerId] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const messageTimer = useRef<number | null>(null);

  const recordedRef = useRef(false);

  const [bestWave, setBestWave] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [bestTime, setBestTime] = useState(0);

  useEffect(() => {
    setBestWave(readStoredNumber(BEST_WAVE_KEY_PREFIX + difficulty));
    setBestScore(readStoredNumber(BEST_SCORE_KEY_PREFIX + difficulty));
    setBestTime(readStoredNumber(BEST_TIME_KEY_PREFIX + difficulty));
  }, [difficulty]);

  const flashMessage = useCallback((text: string) => {
    setMessage(text);
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(null), 1800);
  }, []);

  const applyResult = useCallback(
    (result: CommandResult, successSound?: () => void) => {
      if (!result.ok) {
        playError();
        if (result.reason) flashMessage(result.reason);
        return false;
      }
      stateRef.current = result.state;
      setState(result.state);
      successSound?.();
      return true;
    },
    [flashMessage],
  );

  const startGame = useCallback(() => {
    let fresh = createInitialState(difficulty, mapId, endless);
    fresh = withRocks(fresh, MAP_ROCKS[mapId]);
    stateRef.current = fresh;
    setState(fresh);
    setSelectedTowerId(null);
    setSelectedTowerType(null);
    setHoverCell(null);
    setPaused(false);
    recordedRef.current = false;
    setScreen('playing');
  }, [difficulty, mapId, endless]);

  const backToSetup = useCallback(() => {
    setScreen('setup');
    stateRef.current = null;
    setState(null);
  }, []);

  // ── Fixed-timestep simulation loop ──────────────────────────────────────
  useEffect(() => {
    if (screen !== 'playing') return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dtReal = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (pausedRef.current) return;
      const cur = stateRef.current;
      if (!cur || cur.phase === 'won' || cur.phase === 'lost') return;
      acc += dtReal;
      let next = cur;
      let iterations = 0;
      while (acc >= FIXED_DT && iterations < 12) {
        next = step(next, FIXED_DT);
        acc -= FIXED_DT;
        iterations += 1;
        if (next.phase === 'won' || next.phase === 'lost') break;
      }
      if (next !== cur) {
        stateRef.current = next;
        setState(next);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen]);

  // ── Win/lose bookkeeping ─────────────────────────────────────────────────
  useEffect(() => {
    if (!state) return;
    if (state.phase !== 'won' && state.phase !== 'lost') return;
    if (recordedRef.current) return;
    recordedRef.current = true;

    if (state.phase === 'won') playWin();
    else playLose();

    const waveKey = BEST_WAVE_KEY_PREFIX + state.difficulty;
    const scoreKey = BEST_SCORE_KEY_PREFIX + state.difficulty;
    const timeKey = BEST_TIME_KEY_PREFIX + state.difficulty;

    const reachedWave = state.phase === 'won' ? TOTAL_WAVES : state.wave;
    const prevWave = readStoredNumber(waveKey);
    if (reachedWave > prevWave) writeStoredNumber(waveKey, reachedWave);
    const prevScore = readStoredNumber(scoreKey);
    if (state.score > prevScore) writeStoredNumber(scoreKey, Math.round(state.score));
    if (state.phase === 'won') {
      const prevTime = readStoredNumber(timeKey);
      if (prevTime === 0 || state.elapsedTime < prevTime) writeStoredNumber(timeKey, Math.round(state.elapsedTime));
    }
    setBestWave(Math.max(prevWave, reachedWave));
    setBestScore(Math.max(prevScore, Math.round(state.score)));
  }, [state]);

  // ── Commands ─────────────────────────────────────────────────────────────
  const handleCellClick = useCallback(
    (x: number, y: number) => {
      const cur = stateRef.current;
      if (!cur || cur.phase === 'won' || cur.phase === 'lost' || paused) return;
      const tower = cur.towers.find((t) => t.x === x && t.y === y);
      if (tower) {
        setSelectedTowerId(tower.id);
        setSelectedTowerType(null);
        return;
      }
      if (!selectedTowerType) return;
      applyResult(placeTower(cur, x, y, selectedTowerType), playMove);
    },
    [applyResult, selectedTowerType, paused],
  );

  const handleUpgrade = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || selectedTowerId == null) return;
    applyResult(upgradeTower(cur, selectedTowerId), playMove);
  }, [applyResult, selectedTowerId]);

  const handleSell = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || selectedTowerId == null) return;
    const ok = applyResult(sellTower(cur, selectedTowerId), playMove);
    if (ok) setSelectedTowerId(null);
  }, [applyResult, selectedTowerId]);

  const handleUndo = useCallback(() => {
    const cur = stateRef.current;
    if (!cur) return;
    applyResult(undoLast(cur), playMove);
  }, [applyResult]);

  const handleStartWave = useCallback(
    (early: boolean) => {
      const cur = stateRef.current;
      if (!cur) return;
      applyResult(startNextWave(cur, { early }), playCard);
    },
    [applyResult],
  );

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (TOWER_HOTKEYS[e.key]) {
        e.preventDefault();
        setSelectedTowerType((t) => (t === TOWER_HOTKEYS[e.key] ? null : TOWER_HOTKEYS[e.key]));
        setSelectedTowerId(null);
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleStartWave(true);
        return;
      }
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, handleStartWave, handleUndo, togglePause]);

  // ── Setup screen ─────────────────────────────────────────────────────────
  if (screen === 'setup' || !state) {
    return (
      <div
        className="min-h-screen text-amber-50 flex flex-col items-center justify-center p-4 bg-cover bg-center"
        style={{
          backgroundColor: '#120c06',
          backgroundImage: [
            'linear-gradient(rgba(18,12,6,0.72), rgba(18,12,6,0.88))',
            `url(${import.meta.env.BASE_URL}setup-bg.jpg)`,
          ].join(', '),
        }}
      >
        <BackToMenu />
        <div className="w-full max-w-md bg-[#1c1409]/92 border border-amber-900/50 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
          <h1 className="text-2xl font-bold mb-1">發條守城</h1>
          <p className="text-amber-200/70 text-sm mb-6">
            塔就是牆：擺塔改寫敵人的最短路，但不得完全封死出口。
          </p>

          <div className="mb-4">
            <p className="text-xs text-amber-300/80 mb-2 font-semibold">難度</p>
            <div className="flex gap-2">
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    difficulty === d
                      ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                      : 'border-amber-900/50 bg-black/20 text-amber-200/70 hover:bg-black/30'
                  }`}
                >
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-amber-300/80 mb-2 font-semibold">地圖</p>
            <div className="flex gap-2">
              {(Object.keys(MAP_LABELS) as MapId[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMapId(m)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    mapId === m
                      ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                      : 'border-amber-900/50 bg-black/20 text-amber-200/70 hover:bg-black/30'
                  }`}
                >
                  {MAP_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-xs text-amber-300/80 mb-2 font-semibold">模式</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEndless(false)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  !endless
                    ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                    : 'border-amber-900/50 bg-black/20 text-amber-200/70 hover:bg-black/30'
                }`}
              >
                20 波挑戰
              </button>
              <button
                type="button"
                onClick={() => setEndless(true)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  endless
                    ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                    : 'border-amber-900/50 bg-black/20 text-amber-200/70 hover:bg-black/30'
                }`}
              >
                無盡模式
              </button>
            </div>
          </div>

          <p className="text-xs text-amber-200/60 mb-4">
            最佳波次 {bestWave} ・ 最佳分數 {bestScore}
            {bestTime > 0 ? ` ・ 最短時間 ${bestTime}s` : ''}
          </p>

          <button
            type="button"
            onClick={startGame}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 font-bold text-lg transition-colors"
          >
            開始遊戲
          </button>

          <details className="mt-4 text-xs text-amber-200/70">
            <summary className="cursor-pointer select-none">操作說明</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>點擊底部塔欄選塔（或按 1–4），點擊格子放置</li>
              <li>點擊已放置的塔可升級或售出</li>
              <li>空白鍵：提前召喚下一波（可獲得加成金幣）</li>
              <li>Z：撤銷本波尚未開始前的最後一次放置／升級</li>
              <li>P／Esc：暫停</li>
            </ul>
          </details>
        </div>
      </div>
    );
  }

  // ── Playing screen ───────────────────────────────────────────────────────
  const selectedTower = selectedTowerId != null ? state.towers.find((t) => t.id === selectedTowerId) ?? null : null;
  const canUndo = state.phase === 'prep' && state.lastReversible != null;
  const waveLabel = state.endless ? `第 ${state.wave} 波（無盡）` : `第 ${state.wave} / ${TOTAL_WAVES} 波`;
  const enemiesLeft = state.pendingSpawns.length + state.enemies.length;
  const isOver = state.phase === 'won' || state.phase === 'lost';

  return (
    <div className="min-h-screen bg-[#120c06] text-amber-50 flex flex-col items-center p-3 pb-8 min-w-0">
      <BackToMenu />

      <header className="w-full max-w-3xl flex flex-wrap items-center justify-between gap-2 mb-3 mt-1 text-sm">
        <h1 className="text-lg font-bold">發條守城</h1>
        <div className="flex items-center gap-3 font-mono tabular-nums">
          <span>{waveLabel}</span>
          <span className="text-rose-300">❤ {state.lives}</span>
          <span className="text-amber-300">⚙ {state.gold}</span>
          <span className="text-sky-300">★ {Math.round(state.score)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors touch-manipulation inline-flex items-center justify-center"
            aria-label="撤銷"
            title="撤銷 (Z)"
          >
            ↩
          </button>
          <button
            type="button"
            onClick={togglePause}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors touch-manipulation inline-flex items-center justify-center"
            aria-label="暫停"
            title="暫停 (P)"
          >
            {paused ? '▶' : '⏸'}
          </button>
        </div>
      </header>

      {message && (
        <div className="w-full max-w-3xl mb-2 py-1.5 px-3 rounded-lg bg-rose-900/50 border border-rose-500/40 text-sm text-center">
          {message}
        </div>
      )}

      <Battlefield
        state={state}
        hoverCell={hoverCell}
        selectedTowerType={selectedTowerType}
        selectedTowerId={selectedTowerId}
        onCellHover={setHoverCell}
        onCellClick={handleCellClick}
      />

      {/* Prep / wave status bar */}
      <div className="w-full max-w-3xl mt-3 flex items-center justify-between gap-2 text-sm">
        {state.phase === 'prep' ? (
          <>
            <span className="text-amber-200/80">
              準備中… {Math.max(0, Math.ceil(state.prepTimer))}s
            </span>
            <TouchButton
              label={`召喚下一波（+${Math.floor(Math.max(0, state.prepTimer) * 6)} 金）`}
              ariaLabel="召喚下一波"
              accent
              onClick={() => handleStartWave(true)}
            />
          </>
        ) : (
          <span className="text-amber-200/80">戰鬥中… 剩餘敵人 {enemiesLeft}</span>
        )}
      </div>

      {/* Tower palette */}
      <div className="w-full max-w-3xl mt-3 grid grid-cols-4 gap-2">
        {TOWER_ORDER.map((type, i) => {
          const def = TOWER_DEFS[type];
          const cost = purchaseCost(type);
          const affordable = state.gold >= cost;
          const active = selectedTowerType === type;
          return (
            <button
              key={type}
              type="button"
              disabled={!affordable}
              onClick={() => {
                setSelectedTowerType((t) => (t === type ? null : type));
                setSelectedTowerId(null);
              }}
              className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-xs transition-colors touch-manipulation min-h-[64px] ${
                active
                  ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                  : affordable
                    ? 'border-amber-900/50 bg-black/20 text-amber-100 hover:bg-black/30'
                    : 'border-amber-900/30 bg-black/10 text-amber-200/30 cursor-not-allowed'
              }`}
              title={`${def.name}（快捷鍵 ${i + 1}）`}
            >
              <img
                src={`${import.meta.env.BASE_URL}towers/${type}.jpg`}
                alt=""
                className="w-9 h-9 rounded-lg object-cover border border-amber-900/40 mb-0.5"
                draggable={false}
              />
              <span className="font-semibold">{def.name}</span>
              <span className="font-mono">{cost}G</span>
            </button>
          );
        })}
      </div>

      {/* Selected tower panel */}
      {selectedTower && (
        <div className="w-full max-w-3xl mt-3 p-3 rounded-xl bg-black/30 border border-amber-900/50 flex items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-semibold">
              {TOWER_DEFS[selectedTower.type].name} · Lv.{selectedTower.level + 1}
            </p>
            <p className="text-amber-200/60 text-xs">已投入 {selectedTower.investedGold}G</p>
          </div>
          <div className="flex gap-2">
            {selectedTower.level < 2 && (
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={state.gold < (upgradeCost(selectedTower.type, selectedTower.level) ?? Infinity)}
                className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                升級 {upgradeCost(selectedTower.type, selectedTower.level)}G
              </button>
            )}
            <button
              type="button"
              onClick={handleSell}
              className="px-3 py-2 rounded-lg bg-rose-800 hover:bg-rose-700 font-medium"
            >
              售出 +{sellRefund(selectedTower.investedGold)}G
            </button>
            <button
              type="button"
              onClick={() => setSelectedTowerId(null)}
              className="px-3 py-2 rounded-lg bg-black/30 hover:bg-black/40"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {paused && !isOver && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70">
          <div className="bg-[#1c1409] border border-amber-900/50 rounded-2xl p-6 text-center">
            <h2 className="text-xl font-bold mb-2">已暫停</h2>
            <p className="text-amber-200/70 text-sm mb-4">按 P 或 Esc 繼續</p>
            <button
              type="button"
              onClick={togglePause}
              className="px-6 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold"
            >
              繼續遊戲
            </button>
          </div>
        </div>
      )}

      {isOver && (
        <ResultOverlay
          title={state.phase === 'won' ? '守城成功！' : '城池失守'}
          variant={state.phase === 'won' ? 'win' : 'lose'}
          subtitle={state.phase === 'won' ? '你撐過了全部波次。' : `倒在第 ${state.wave} 波。`}
          stats={[
            { label: '波次', value: state.phase === 'won' ? `${TOTAL_WAVES}（通關）` : state.wave },
            { label: '擊殺數', value: state.kills },
            { label: '剩餘生命', value: state.lives },
            { label: '未花費金幣', value: state.gold },
            { label: '分數', value: Math.round(state.score) },
            { label: '最佳波次', value: bestWave },
            { label: '最佳分數', value: bestScore },
          ]}
          primaryLabel="再玩一次"
          onPrimary={startGame}
          secondaryLabel="回設定"
          onSecondary={backToSetup}
        />
      )}
    </div>
  );
}
