import {useCallback, useEffect, useRef, useState} from 'react';
import {BackToMenu} from '@clubhouse/shared/BackToMenu';
import {Hud, type HudSnapshot} from './components/Hud';
import {MainMenu} from './components/MainMenu';
import {ResultScreen} from './components/ResultScreen';
import {CupStandingsOverlay} from './components/CupStandings';
import {TouchControls, type ControlKey} from './components/TouchControls';
import {CHARACTERS, type DifficultyId} from './data/characters';
import {cupById, pointsForPlace} from './data/cups';
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
  applyRacePlaces,
  createCupSession,
  cupDef,
  cupTrackId,
  isLastCupRace,
  playerOverallPlace,
  type CupSession,
} from './engine/cupSession';
import {GhostRecorder, type GhostLap} from './engine/ghost';
import {
  applyCupFinish as applyCupProgress,
  getGhost,
  loadProgress,
  maybeStoreGhost,
  recordRaceFinished,
  saveProgress,
  type KartProgress,
} from './engine/progress';
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
  slipstream: 0,
  cupLabel: '',
  ghostDelta: null,
};

type CupOverlay = {
  session: CupSession;
  final: boolean;
  lastRacePlaces: {id: string; place: number; points: number}[];
  unlockedMessages: string[];
};

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'race'>('menu');
  const [charId, setCharId] = useState(CHARACTERS[0].id);
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [cupId, setCupId] = useState('brick-cup');
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [raceOptions, setRaceOptions] = useState<RaceOptions>(DEFAULT_RACE_OPTIONS);
  const [bestTimes, setBestTimes] = useState<Record<string, number>>(() => loadBestTimes());
  const [progress, setProgress] = useState<KartProgress>(() => loadProgress());

  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [result, setResult] = useState<{
    state: RaceState;
    bestLap: number;
    record: boolean;
    ghostSaved: boolean;
  } | null>(null);
  const [cupSession, setCupSession] = useState<CupSession | null>(null);
  const [cupOverlay, setCupOverlay] = useState<CupOverlay | null>(null);

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
  const ghostRecorderRef = useRef(new GhostRecorder());
  const raceLapStartRef = useRef(0);
  const cupSessionRef = useRef<CupSession | null>(null);
  const progressRef = useRef(progress);
  const raceOptionsRef = useRef(raceOptions);
  const trackIdRef = useRef(trackId);
  const charIdRef = useRef(charId);
  const difficultyRef = useRef(difficulty);

  pausedRef.current = paused || result !== null || cupOverlay !== null;
  cupSessionRef.current = cupSession;
  progressRef.current = progress;
  raceOptionsRef.current = raceOptions;
  trackIdRef.current = trackId;
  charIdRef.current = charId;
  difficultyRef.current = difficulty;

  useEffect(() => {
    void preloadTrackArt();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const handleHold = useCallback((key: ControlKey, down: boolean) => {
    touchRef.current[key] = down;
    if (key === 'item' && down) itemQueuedRef.current = true;
  }, []);

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

    const opts = raceOptionsRef.current;
    const tid = trackIdRef.current;
    const cid = charIdRef.current;
    const diff = difficultyRef.current;
    const session = cupSessionRef.current;
    const prog = progressRef.current;

    const ghost =
      opts.mode === 'timeTrial' ? getGhost(prog, tid, opts.mirror) : null;

    const cpuRoster =
      opts.mode === 'grandPrix' && session
        ? session.rivals.map((r) => ({
            charId: r.charId,
            name: CHARACTERS.find((c) => c.id === r.charId)?.name,
            rival: r,
          }))
        : undefined;

    const rc = createRenderContext(canvas);
    const state = createRace(tid, cid, diff, opts, {cpuRoster, ghost});
    const cam = createCamera(state.racers[state.playerIndex]);
    lapFlashRef.current = 0;
    lapNoteRef.current = '';
    ghostRecorderRef.current.reset();
    raceLapStartRef.current = 0;
    let ghostRecording = false;
    let bestGhostCandidate: GhostLap | null = null;

    startEngine();
    setMuted(isMuted());

    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;
    let nextTick = 3;
    let finishedHandled = false;
    const recordKey = bestLapKey(tid, opts, diff);
    const cup = session ? cupDef(session) : null;
    const cupLabel =
      opts.mode === 'grandPrix' && cup
        ? `${cup.name} ${session!.raceIndex + 1}/${cup.trackIds.length}`
        : '';

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
        const wasCountdown = state.phase === 'countdown';
        stepRace(state, input, dt);

        if (wasCountdown && state.phase === 'racing' && opts.mode === 'timeTrial') {
          ghostRecorderRef.current.begin();
          ghostRecording = true;
          raceLapStartRef.current = state.time;
        }

        if (state.phase === 'countdown' && Math.ceil(state.countdown) < nextTick) {
          nextTick = Math.ceil(state.countdown);
          if (nextTick >= 0 && beforeCountdown <= 3) playCountdownTick();
        }

        const player = state.racers[state.playerIndex];

        if (ghostRecording && !player.finished) {
          ghostRecorderRef.current.sample(
            state.time,
            player.x,
            player.y,
            player.angle,
            dt,
          );
        }

        for (const ev of state.events) {
          if (ev === 'lap') {
            lapFlashRef.current = 1.4;
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

            // Capture best-lap ghost slice in time trial.
            if (opts.mode === 'timeTrial' && lastLap > 0) {
              const lapEnd = state.time;
              const lapStart = raceLapStartRef.current;
              const samples = ghostRecorderRef.current.sliceLap(lapStart, lapEnd);
              if (samples.length >= 2) {
                const candidate: GhostLap = {
                  trackId: tid,
                  mirror: opts.mirror,
                  duration: lastLap,
                  samples,
                };
                if (
                  !bestGhostCandidate ||
                  candidate.duration < bestGhostCandidate.duration
                ) {
                  bestGhostCandidate = candidate;
                }
              }
              raceLapStartRef.current = state.time;
            }
          }
          playEvent(ev);
        }
        state.events.length = 0;

        updateCamera(cam, player, dt);
        updateEngine(
          Math.min(1, Math.max(0, player.speed / 340)),
          player.boostTime > 0 || player.slipstream > 0.3,
        );

        if (lapFlashRef.current > 0) lapFlashRef.current -= dt;

        if (player.finished && !finishedHandled) {
          finishedHandled = true;
          ghostRecording = false;
          const laps = player.lapTimes.filter((t) => t > 0);
          const best = laps.length ? Math.min(...laps) : 0;
          const prev = loadBestTimes();
          const record = best > 0 && (!prev[recordKey] || best < prev[recordKey]);
          if (record) {
            const next = {...prev, [recordKey]: best};
            localStorage.setItem(BEST_KEY, JSON.stringify(next));
            setBestTimes(next);
          }

          let ghostSaved = false;
          let nextProgress = recordRaceFinished(
            progressRef.current,
            opts.mode === 'timeTrial',
          );
          if (opts.mode === 'timeTrial' && bestGhostCandidate) {
            const stored = maybeStoreGhost(nextProgress, bestGhostCandidate);
            nextProgress = stored.progress;
            ghostSaved = stored.stored;
          }
          saveProgress(nextProgress);
          setProgress(nextProgress);
          progressRef.current = nextProgress;

          playFinish(
            opts.mode === 'timeTrial' ||
              opts.mode === 'grandPrix' ||
              player.place === 1,
          );

          if (opts.mode === 'grandPrix' && session) {
            const placesById: Record<string, number> = {};
            const lastRacePlaces: {id: string; place: number; points: number}[] = [];
            for (const r of state.racers) {
              placesById[r.entrantId] = r.place;
              lastRacePlaces.push({
                id: r.entrantId,
                place: r.place,
                points: pointsForPlace(r.place),
              });
            }
            const wasLast = isLastCupRace(session);
            const advanced = applyRacePlaces(session, placesById);
            setCupSession(advanced);
            cupSessionRef.current = advanced;

            if (wasLast) {
              const overall = playerOverallPlace(advanced);
              const reward = applyCupProgress(nextProgress, advanced.cupId, overall);
              saveProgress(reward.progress);
              setProgress(reward.progress);
              progressRef.current = reward.progress;
              if (reward.unlocked.length) playEvent('cup-unlock');
              setCupOverlay({
                session: advanced,
                final: true,
                lastRacePlaces,
                unlockedMessages: reward.unlocked,
              });
            } else {
              setCupOverlay({
                session: advanced,
                final: false,
                lastRacePlaces,
                unlockedMessages: [],
              });
            }
          } else {
            setResult({state, bestLap: best, record, ghostSaved});
          }
        }
      }

      renderFrame(rc, state, cam);

      hudTimer += dt;
      if (hudTimer > 0.06) {
        hudTimer = 0;
        const player = state.racers[state.playerIndex];
        const laps = player.lapTimes.filter((t) => t > 0);
        let ghostDelta: number | null = null;
        if (state.ghostLap && state.phase === 'racing') {
          // Ghost replays the best lap on a loop from race start; compare
          // current-lap elapsed clock against the ghost's loop clock.
          const lapElapsed = Math.max(0, state.time - raceLapStartRef.current);
          const ghostLapTime = state.time % state.ghostLap.duration;
          ghostDelta = lapElapsed - ghostLapTime;
        }
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
          slipstream: player.slipstream,
          cupLabel,
          ghostDelta: state.ghostLap && state.phase === 'racing' ? ghostDelta : null,
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
    // Re-run when a new race is staged (track / cup race index / options).
  }, [screen, loading, trackId, charId, difficulty, raceOptions, cupSession?.raceIndex]);

  const startRace = useCallback(() => {
    setResult(null);
    setCupOverlay(null);
    setPaused(false);
    setHud(EMPTY_HUD);
    setLoading(true);
    setScreen('race');
    void preloadTrackArt().then(() => {
      clearBackdrops();
      setLoading(false);
    });
  }, []);

  const beginFromMenu = useCallback(() => {
    if (raceOptions.mode === 'grandPrix') {
      const cup = cupById(cupId);
      if (!cup) return;
      const player = CHARACTERS.find((c) => c.id === charId) ?? CHARACTERS[0];
      const session = createCupSession(cupId, charId, player.name, difficulty);
      const nextTrack = cupTrackId(session);
      const nextOpts: RaceOptions = {
        ...raceOptions,
        mode: 'grandPrix',
        mirror: cup.mirror,
        itemsEnabled: true,
      };
      setCupSession(session);
      cupSessionRef.current = session;
      setTrackId(nextTrack);
      trackIdRef.current = nextTrack;
      setRaceOptions(nextOpts);
      raceOptionsRef.current = nextOpts;
    } else {
      setCupSession(null);
      cupSessionRef.current = null;
    }
    startRace();
  }, [raceOptions, cupId, charId, difficulty, startRace]);

  const continueCup = useCallback(() => {
    if (!cupOverlay) return;
    if (cupOverlay.final) {
      setCupOverlay(null);
      setCupSession(null);
      cupSessionRef.current = null;
      setResult(null);
      setPaused(false);
      setScreen('menu');
      return;
    }
    const session = cupOverlay.session;
    const nextTrack = cupTrackId(session);
    setCupOverlay(null);
    setCupSession(session);
    cupSessionRef.current = session;
    setTrackId(nextTrack);
    trackIdRef.current = nextTrack;
    startRace();
  }, [cupOverlay, startRace]);

  const backToMenu = useCallback(() => {
    setResult(null);
    setCupOverlay(null);
    setCupSession(null);
    cupSessionRef.current = null;
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
          cupId={cupId}
          difficulty={difficulty}
          options={raceOptions}
          bestTimes={bestTimes}
          progress={progress}
          onChar={setCharId}
          onTrack={setTrackId}
          onCup={setCupId}
          onDifficulty={setDifficulty}
          onOptions={(patch) => setRaceOptions((o) => ({...o, ...patch}))}
          onStart={beginFromMenu}
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

        {paused && !result && !cupOverlay && (
          <div
            className="absolute inset-0 z-20 grid place-items-center bg-slate-950/80 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kart-pause-title"
          >
            <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-slate-900 p-6 text-center">
              <h2 id="kart-pause-title" className="mb-4 text-2xl font-black text-white">
                暫停
              </h2>
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

        {cupOverlay && (
          <CupStandingsOverlay
            session={cupOverlay.session}
            lastRacePlaces={cupOverlay.lastRacePlaces}
            unlockedMessages={cupOverlay.unlockedMessages}
            final={cupOverlay.final}
            onContinue={continueCup}
            onMenu={backToMenu}
          />
        )}

        {result && !cupOverlay && (
          <ResultScreen
            racers={result.state.racers}
            playerIndex={result.state.playerIndex}
            trackId={trackId}
            bestLap={result.bestLap}
            isNewRecord={result.record}
            timeTrial={result.state.mode === 'timeTrial'}
            mirror={result.state.mirror}
            itemsEnabled={result.state.itemsEnabled}
            ghostSaved={result.ghostSaved}
            onRetry={startRace}
            onMenu={backToMenu}
          />
        )}
      </div>
    </div>
  );
}
