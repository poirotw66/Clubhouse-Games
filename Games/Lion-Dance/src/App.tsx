import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { GameCanvas } from './components/GameCanvas';
import { HowToHint } from './components/HowToHint';
import { Hud } from './components/Hud';
import { TouchPad } from './components/TouchPad';
import { formatOnBeatPercent } from './engine/beat';
import { GAME_PATH, TRACK_LENGTH, type LegId, type PlayMode } from './engine/constants';
import type { HudSnapshot, LionWorld, RunResult } from './engine/LionWorld';
import {
  loadBestTime,
  loadLang,
  loadMode,
  loadMute,
  saveBestTime,
  saveGhost,
  saveLang,
  saveMode,
  saveMute,
  shareToX,
  type Lang,
} from './engine/storage';
import { rankForFinishTime, retryRank } from './engine/titles';
import { formatDistance, formatTime, t } from './i18n';

type Screen = 'title' | 'playing' | 'result';

const EMPTY_HUD: HudSnapshot = {
  distance: 0,
  timeLeft: 90,
  elapsed: 0,
  fallen: false,
  finished: false,
  finishAnim: 0,
  pitch: 0,
  roll: 0,
  legLift: { FL: 0, FR: 0, BL: 0, BR: 0 },
  legSwing: { FL: 0, FR: 0, BL: 0, BR: 0 },
  beatPulse: 0,
  combo: 0,
  perfectFlash: 0,
  onBeatRatio: 0,
  speedBonus: 0,
};

export default function App(): ReactElement {
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [mode, setMode] = useState<PlayMode>(() => loadMode());
  const [muted, setMutedState] = useState(() => loadMute());
  const [screen, setScreen] = useState<Screen>('title');
  const [runId, setRunId] = useState(0);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [best1p, setBest1p] = useState<number | null>(() => loadBestTime('1p'));
  const [best2p, setBest2p] = useState<number | null>(() => loadBestTime('2p'));
  const [result, setResult] = useState<RunResult | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const worldRef = useRef<LionWorld | null>(null);
  const s = t(lang);
  const best = mode === '2p' ? best2p : best1p;

  const worldConfig = useMemo(() => ({ mode, muted }), [mode, muted]);

  const onHud = useCallback((next: HudSnapshot) => setHud(next), []);

  const onRunEnd = useCallback(
    (r: RunResult) => {
      setResult(r);
      setScreen('result');
      setShowHint(false);
      if (r.reason === 'finish') {
        const saved = saveBestTime(r.mode, r.elapsed);
        if (r.mode === '2p') setBest2p(loadBestTime('2p'));
        else setBest1p(loadBestTime('1p'));
        setIsNewBest(saved === r.elapsed);
        const samples = worldRef.current?.getGhostSamples() ?? [];
        if (saved === r.elapsed) saveGhost(r.mode, samples);
      } else {
        setIsNewBest(false);
      }
    },
    [],
  );

  const startRun = useCallback(() => {
    setResult(null);
    setHud(EMPTY_HUD);
    setIsNewBest(false);
    setShowHint(true);
    setRunId((n) => n + 1);
    setScreen('playing');
  }, []);

  const selectMode = useCallback((m: PlayMode) => {
    setMode(m);
    saveMode(m);
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next: Lang = prev === 'zh' ? 'en' : 'zh';
      saveLang(next);
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      saveMute(next);
      worldRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const onLeg = useCallback((id: LegId, held: boolean) => {
    worldRef.current?.setLeg(id, held);
  }, []);

  const onGetUp = useCallback(() => {
    worldRef.current?.getUpOrRestart();
    if (screen === 'result') startRun();
  }, [screen, startRun]);

  const rank = useMemo(() => {
    if (!result) return null;
    if (result.reason !== 'finish') return retryRank();
    return rankForFinishTime(result.elapsed);
  }, [result]);

  const share = useCallback(() => {
    if (!result || !rank) return;
    const url = `${window.location.origin}${GAME_PATH}`;
    const modeLabel = s.modeLabel(result.mode);
    const beat = formatOnBeatPercent(result.onBeatRatio);
    const text =
      result.reason === 'finish'
        ? s.shareWin(modeLabel, s.ranks[rank.id], formatTime(result.elapsed), beat)
        : s.shareLose(modeLabel, formatDistance(result.distance, lang), beat);
    shareToX(text, url);
  }, [result, rank, s, lang]);

  return (
    <div className="lion-app">
      <BackToMenu />
      <GameCanvas
        runId={runId}
        playing={screen === 'playing'}
        config={worldConfig}
        onHud={onHud}
        onRunEnd={onRunEnd}
        worldRef={worldRef}
      />

      {screen === 'playing' && <Hud hud={hud} s={s} lang={lang} best={best} />}

      <HowToHint s={s} visible={screen === 'playing' && showHint} onDismiss={() => setShowHint(false)} />

      <TouchPad
        visible={screen === 'playing'}
        mode={mode}
        s={s}
        onLeg={onLeg}
        onGetUp={onGetUp}
      />

      {screen === 'title' && (
        <div className="lion-title-shell">
          <div className="lion-title-card">
            <p className="lion-eyebrow">Clubhouse Games</p>
            <h1 className="lion-brand">{s.title}</h1>
            <p className="lion-sub">{s.subtitle}</p>
            <p className="lion-tag">{s.tagline}</p>

            <div className="lion-mode-row" role="group" aria-label="mode">
              <button
                type="button"
                className={`lion-mode-chip ${mode === '1p' ? 'is-active' : ''}`}
                onClick={() => selectMode('1p')}
              >
                {s.mode1p}
              </button>
              <button
                type="button"
                className={`lion-mode-chip ${mode === '2p' ? 'is-active' : ''}`}
                onClick={() => selectMode('2p')}
              >
                {s.mode2p}
              </button>
            </div>
            <p className="lion-mode-hint">{mode === '2p' ? s.modeHint2p : s.modeHint1p}</p>

            <p className="lion-best-line">
              {s.best1p}：{best1p != null ? formatTime(best1p) : s.noBest}
              <span className="lion-best-sep">·</span>
              {s.best2p}：{best2p != null ? formatTime(best2p) : s.noBest}
            </p>

            <button type="button" className="lion-cta" onClick={startRun}>
              {s.start}
            </button>
            <button type="button" className="lion-cta-ghost" onClick={() => setShowHowTo(true)}>
              {s.howTo}
            </button>
            <div className="lion-title-tools">
              <button type="button" className="lion-lang" onClick={toggleMute}>
                {muted ? s.muteOn : s.muteOff}
              </button>
              <button type="button" className="lion-lang" onClick={toggleLang}>
                {s.langToggle}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHowTo && (
        <div className="lion-howto" role="dialog" aria-modal="true" aria-label={s.howTo}>
          <div className="lion-howto-card">
            <h2>{s.howTo}</h2>
            <ol>
              {s.howtoBody.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            <button type="button" className="lion-cta" onClick={() => setShowHowTo(false)}>
              {s.close}
            </button>
          </div>
        </div>
      )}

      {screen === 'result' && result && rank && (
        <ResultOverlay
          title={s.ranks[rank.id]}
          badge={result.reason === 'finish' ? s.resultFinish : s.resultFail}
          subtitle={
            result.reason === 'finish'
              ? `${s.modeLabel(result.mode)} · ${formatTime(result.elapsed)}${
                  isNewBest ? (lang === 'zh' ? ' · 新紀錄！' : ' · New best!') : ''
                }`
              : result.reason === 'timeout'
                ? s.timeoutSub
                : s.fallSub
          }
          stats={[
            {
              label: s.distance,
              value: formatDistance(Math.min(TRACK_LENGTH, result.distance), lang),
            },
            ...(result.reason === 'finish'
              ? [{ label: lang === 'zh' ? '時間' : 'Time', value: formatTime(result.elapsed) }]
              : [{ label: s.best, value: best != null ? formatTime(best) : '—' }]),
            {
              label: s.onBeat,
              value: formatOnBeatPercent(result.onBeatRatio),
            },
            {
              label: s.combo,
              value: `×${result.maxCombo}`,
            },
          ]}
          primaryLabel={s.playAgain}
          onPrimary={startRun}
          secondaryLabel={s.share}
          onSecondary={share}
          variant={result.reason === 'finish' ? 'win' : 'lose'}
        />
      )}

      {screen === 'playing' && (
        <button type="button" className="lion-mute-fab" onClick={toggleMute} aria-pressed={muted}>
          {muted ? s.muteOn : s.muteOff}
        </button>
      )}

      {screen === 'title' && (
        <div className="lion-desktop-hint hidden md:block" aria-hidden="true">
          Q W O P · R
        </div>
      )}
    </div>
  );
}
