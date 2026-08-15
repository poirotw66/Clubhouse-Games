import {useCallback, useEffect, useRef, useState} from 'react';
import {BackToMenu} from '@clubhouse/shared/BackToMenu';
import {Hud, type HudSnapshot} from './components/Hud';
import {MainMenu} from './components/MainMenu';
import {ResultScreen} from './components/ResultScreen';
import {TouchControls, type ControlKey} from './components/TouchControls';
import {CHARACTERS, type DifficultyId} from './data/characters';
import {TRACKS} from './data/tracks';
import {
  isMuted,
  playCountdownTick,
  playEvent,
  playFinish,
  setMuted,
  startEngine,
  stopEngine,
  updateEngine,
} from './engine/audio';
import {LAP_TOTAL} from './engine/constants';
import {
  bestLapKey,
  createRace,
  DEFAULT_RACE_OPTIONS,
  driftFill,
  driftLevel,
  formatTime,
  migrateBestTimesMap,
  stepRace,
  type RaceInput,
  type RaceOptions,
  type RaceState,
} from './engine/race';
import {
  clearBackdrops,
  createCamera,
  createRenderContext,
  drawMinimap,
  renderFrame,
  updateCamera,
} from './engine/renderer';
import {preloadTrackArt} from './engine/trackAssets';

const BEST_KEY = 'brick-kart-racing:best-laps';

function loadBestTimes(): Record<string, number> {
  try {
    const map = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as Record<string, number>;
    if (migrateBestTimesMap(map)) {
      localStorage.setItem(BEST_KEY, JSON.stringify(map));
    }
    return map;
  } catch {
    return {};
  }
}

const EMPTY_HUD: HudSnapshot = {
  place: 1,
  lap: 1,
  laps: LAP_TOTAL,
  time: 0,
  bestLap: 0,
  speed: 0,
  item: null,
  itemRoll: 0,
  shields: 0,
  driftLevel: 0,
  driftFill: 0,
  boosting: false,
  countdown: 3.6,
  phase: 'countdown',
  lapFlash: 0,
  lapNote: '',
  itemsEnabled: true,
  timeTrial: false,
};

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'race'>('menu');
  const [charId, setCharId] = useState(CHARACTERS[0].id);
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [raceOptions, setRaceOptions] = useState<RaceOptions>(DEFAULT_RACE_OPTIONS);
  const [bestTimes, setBestTimes] = useState<Record<string, number>>(() => loadBestTimes());

  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [result, setResult] = useState<{state: RaceState; bestLap: number; record: boolean} | null>(
    null,
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef(new Set<string>());
  const touchRef = useRef<Record<ControlKey, boolean>>({
    left: false,
    right: false,
    throttle: false,
    brake: false,
    drift: false,
    item: false,
  });
  const itemQueuedRef = useRef(false);
  const pausedRef = useRef(false);
  const lapFlashRef = useRef(0);
  const lapNoteRef = useRef('');

  pausedRef.current = paused || result !== null;

  useEffect(() => {
    void preloadTrackArt();
  }, []);

  const handleHold = useCallback((key: ControlKey, down: boolean) => {
    touchRef.current[key] = down;
    if (key === 'item' && down) itemQueuedRef.current = true;
  }, []);

  // --- Keyboard -------------------------------------------------------------
  useEffect(() => {
    if (screen !== 'race') return;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (
        ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift'].includes(k) ||
        k === 'z'
      ) {
        e.preventDefault();
      }
      if (k === ' ' && !keysRef.current.has(' ')) itemQueuedRef.current = true;
      if (k === 'p') setPaused((p) => !p);
      if (k === 'm') {
        setMutedState((m) => {
          setMuted(!m);
          return !m;
        });
      }
      keysRef.current.add(k);
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    const blur = () => keysRef.current.clear();

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      keysRef.current.clear();
    };
  }, [screen]);

  // --- Race loop ------------------------------------------------------------
  useEffect(() => {
    if (screen !== 'race' || loading) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rc = createRenderContext(canvas);
    const state = createRace(trackId, charId, difficulty, raceOptions);
    const cam = createCamera(state.racers[state.playerIndex]);
    lapFlashRef.current = 0;
    lapNoteRef.current = '';

    startEngine();
    setMuted(isMuted());

    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;
    let nextTick = 3;
    let finishedHandled = false;
    const recordKey = bestLapKey(trackId, raceOptions, difficulty);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!pausedRef.current) {
        const keys = keysRef.current;
        const touch = touchRef.current;
        const left = keys.has('arrowleft') || keys.has('a') || touch.left;
        const right = keys.has('arrowright') || keys.has('d') || touch.right;
        const input: RaceInput = {
          steer: (left ? -1 : 0) + (right ? 1 : 0),
          throttle: keys.has('arrowup') || keys.has('z') || keys.has('w') || touch.throttle,
          brake: keys.has('arrowdown') || keys.has('s') || touch.brake,
          drift: keys.has('shift') || touch.drift,
          useItem: itemQueuedRef.current,
        };
        itemQueuedRef.current = false;

        const beforeCountdown = state.countdown;
        stepRace(state, input, dt);

        if (state.phase === 'countdown' && Math.ceil(state.countdown) < nextTick) {
          nextTick = Math.ceil(state.countdown);
          if (nextTick >= 0 && beforeCountdown <= 3) playCountdownTick();
        }

        for (const ev of state.events) {
          if (ev === 'lap') {
            lapFlashRef.current = 1.4;
            const player = state.racers[state.playerIndex];
            const lastLap = player.lapTimes[player.lapTimes.length - 1] ?? 0;
            const stored = loadBestTimes()[recordKey] ?? 0;
            const sessionBest = player.lapTimes.slice(0, -1).filter((t) => t > 0);
            const priorBest = sessionBest.length ? Math.min(...sessionBest) : 0;
            if (lastLap > 0 && (!stored || lastLap < stored)) {
              lapNoteRef.current = `新最佳！ ${formatTime(lastLap)}`;
            } else if (lastLap > 0 && priorBest > 0 && lastLap < priorBest) {
              lapNoteRef.current = `本場最快 ${formatTime(lastLap)}`;
            } else if (lastLap > 0) {
              lapNoteRef.current = formatTime(lastLap);
            } else {
              lapNoteRef.current = '';
            }
          }
          playEvent(ev);
        }
        state.events.length = 0;

        const player = state.racers[state.playerIndex];
        updateCamera(cam, player, dt);
        updateEngine(
          Math.min(1, Math.max(0, player.speed / 340)),
          player.boostTime > 0,
        );

        if (lapFlashRef.current > 0) lapFlashRef.current -= dt;

        if (player.finished && !finishedHandled) {
          finishedHandled = true;
          const laps = player.lapTimes.filter((t) => t > 0);
          const best = laps.length ? Math.min(...laps) : 0;
          const prev = loadBestTimes();
          const record = best > 0 && (!prev[recordKey] || best < prev[recordKey]);
          if (record) {
            const next = {...prev, [recordKey]: best};
            localStorage.setItem(BEST_KEY, JSON.stringify(next));
            setBestTimes(next);
          }
          playFinish(state.mode === 'timeTrial' || player.place === 1);
          setResult({state, bestLap: best, record});
        }
      }

      renderFrame(rc, state, cam);

      hudTimer += dt;
      if (hudTimer > 0.06) {
        hudTimer = 0;
        const player = state.racers[state.playerIndex];
        const laps = player.lapTimes.filter((t) => t > 0);
        setHud({
          place: player.place,
          lap: player.lap,
          laps: state.laps,
          time: state.time,
          bestLap: laps.length ? Math.min(...laps) : 0,
          speed: player.speed,
          item: player.item,
          itemRoll: player.itemRoll,
          shields: player.shields,
          driftLevel: player.drifting ? driftLevel(player.driftCharge) : 0,
          driftFill: player.drifting ? driftFill(player.driftCharge) : 0,
          boosting: player.boostTime > 0,
          countdown: state.countdown,
          phase: state.phase,
          lapFlash: Math.max(0, lapFlashRef.current),
          lapNote: lapNoteRef.current,
          itemsEnabled: state.itemsEnabled,
          timeTrial: state.mode === 'timeTrial',
        });
        const mini = minimapRef.current;
        if (mini) drawMinimap(mini.getContext('2d')!, state, mini.width);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      stopEngine();
    };
  }, [screen, loading, trackId, charId, difficulty, raceOptions]);

  const startRace = useCallback(() => {
    setResult(null);
    setPaused(false);
    setHud(EMPTY_HUD);
    setLoading(true);
    setScreen('race');
    // Wait for albedo/sky plates so Mode-7 bake includes them, then drop caches.
    void preloadTrackArt().then(() => {
      clearBackdrops();
      setLoading(false);
    });
  }, []);

  const backToMenu = useCallback(() => {
    setResult(null);
    setPaused(false);
    setScreen('menu');
  }, []);

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      setMuted(!m);
      return !m;
    });
  }, []);

  if (screen === 'menu') {
    return (
      <>
        <BackToMenu />
        <MainMenu
          charId={charId}
          trackId={trackId}
          difficulty={difficulty}
          options={raceOptions}
          bestTimes={bestTimes}
          onChar={setCharId}
          onTrack={setTrackId}
          onDifficulty={setDifficulty}
          onOptions={(patch) => setRaceOptions((o) => ({...o, ...patch}))}
          onStart={startRace}
        />
      </>
    );
  }

  return (
    <div className="grid h-full w-full place-items-center bg-slate-950">
      <div className="relative aspect-video max-h-full w-full max-w-[min(100vw,177.78vh)]">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          style={{imageRendering: 'pixelated', display: 'block'}}
        />

        {loading ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-950 text-slate-300">
            <div className="text-center">
              <p className="text-lg font-bold">正在拼砌賽道…</p>
              <p className="mt-1 text-sm text-slate-500">
                {TRACKS.find((t) => t.id === trackId)?.name}
              </p>
            </div>
          </div>
        ) : (
          <>
            <Hud
              snap={hud}
              minimapRef={minimapRef}
              muted={muted}
              onPause={() => setPaused((p) => !p)}
              onMute={toggleMute}
            />
            <TouchControls onHold={handleHold} showItem={hud.itemsEnabled} />
          </>
        )}

        {paused && !result && (
          <div
            className="absolute inset-0 z-20 grid place-items-center bg-slate-950/80 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kart-pause-title"
          >
            <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-slate-900 p-6 text-center">
              <h2 id="kart-pause-title" className="mb-4 text-2xl font-black text-white">暫停</h2>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPaused(false)}
                  className="w-full min-h-[44px] rounded-xl bg-amber-400 py-3 font-black text-slate-950 touch-manipulation"
                >
                  繼續比賽
                </button>
                <button
                  type="button"
                  onClick={backToMenu}
                  className="w-full min-h-[44px] rounded-xl border border-white/15 bg-slate-800 py-3 font-bold text-slate-200 touch-manipulation"
                >
                  回選單
                </button>
              </div>
            </div>
          </div>
        )}

        {result && (
          <ResultScreen
            racers={result.state.racers}
            playerIndex={result.state.playerIndex}
            trackId={trackId}
            bestLap={result.bestLap}
            isNewRecord={result.record}
            timeTrial={result.state.mode === 'timeTrial'}
            mirror={result.state.mirror}
            itemsEnabled={result.state.itemsEnabled}
            onRetry={startRace}
            onMenu={backToMenu}
          />
        )}
      </div>
    </div>
  );
}
