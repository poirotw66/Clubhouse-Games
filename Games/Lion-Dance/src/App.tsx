import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { GameCanvas } from './components/GameCanvas';
import { HowToHint } from './components/HowToHint';
import { Hud } from './components/Hud';
import { LionResult } from './components/LionResult';
import { TouchPad } from './components/TouchPad';
import { formatOnBeatPercent } from './engine/beat';
import { GAME_PATH, TRACK_LENGTH, type LegId, type PlayMode } from './engine/constants';
import type { HudSnapshot, LionWorld, RunResult } from './engine/LionWorld';
import {
  loadAssist,
  loadBestTime,
  loadLang,
  loadMode,
  loadMute,
  saveAssist,
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

const EMPTY_HELD: Record<LegId, boolean> = { FL: false, FR: false, BL: false, BR: false };

const EMPTY_HUD: HudSnapshot = {
  distance: 0,
  distanceToGoal: TRACK_LENGTH,
  timeLeft: 90,
  elapsed: 0,
  fallen: false,
  finished: false,
  finishAnim: 0,
  pitch: 0,
  roll: 0,
  legLift: { FL: 0, FR: 0, BL: 0, BR: 0 },
  legSwing: { FL: 0, FR: 0, BL: 0, BR: 0 },
  legHeld: { ...EMPTY_HELD },
  beatPulse: 0,
  combo: 0,
  perfectFlash: 0,
  onBeatRatio: 0,
  speedBonus: 0,
  fallCount: 0,
  steps: 0,
};

export default function App(): ReactElement {
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [mode, setMode] = useState<PlayMode>(() => loadMode());
  const [muted, setMutedState] = useState(() => loadMute());
  const [assist, setAssistState] = useState(() => loadAssist());
  const [screen, setScreen] = useState<Screen>('title');
  const [runId, setRunId] = useState(0);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [best1p, setBest1p] = useState<number | null>(() => loadBestTime('1p'));
  const [best2p, setBest2p] = useState<number | null>(() => loadBestTime('2p'));
  const [result, setResult] = useState<RunResult | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [stampText, setStampText] = useState<string | null>(null);
  const worldRef = useRef<LionWorld | null>(null);
  const hintCleared = useRef(false);
  const s = t(lang);

  const worldConfig = useMemo(() => ({ mode, muted, assist }), [mode, muted, assist]);

  const onHud = useCallback(
    (next: HudSnapshot) => {
      setHud(next);
      if (!hintCleared.current && next.steps >= 2 && next.distance > 0.4) {
        hintCleared.current = true;
        setShowHint(false);
      }
      if (next.fallen && !next.finished) {
        setStampText((prev) => prev ?? s.fallStampAlt);
      } else if (!next.fallen) {
        setStampText(null);
      }
    },
    [s.fallStamp, s.fallStampAlt],
  );

  const onRunEnd = useCallback((r: RunResult) => {
    setResult(r);
    setScreen('result');
    setShowHint(false);
    setStampText(null);
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
  }, []);

  const startRun = useCallback(() => {
    setResult(null);
    setHud(EMPTY_HUD);
    setIsNewBest(false);
    setStampText(null);
    hintCleared.current = false;
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

  const toggleAssist = useCallback(() => {
    setAssistState((prev) => {
      const next = !prev;
      saveAssist(next);
      worldRef.current?.setAssist(next);
      return next;
    });
  }, []);

  const onLeg = useCallback((id: LegId, held: boolean) => {
    worldRef.current?.setLeg(id, held);
  }, []);

  const onGetUp = useCallback(() => {
    worldRef.current?.getUpOrRestart();
    setStampText(null);
    if (screen === 'result') startRun();
  }, [screen, startRun]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.code === 'Space' && screen === 'title' && !showHowTo) {
        e.preventDefault();
        startRun();
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        if (screen === 'playing' || screen === 'title') setShowHowTo(true);
      }
      if (e.key === 'Escape' && showHowTo) setShowHowTo(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, showHowTo, startRun]);

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

  const canvasActive = screen === 'title' || screen === 'playing';
  const attract = screen === 'title';

  return (
    <div className="lion-app">
      {/* Always mount shared chrome — site.spec and players expect 返回總覽 on the title screen too. */}
      <BackToMenu />
      <GameCanvas
        runId={runId}
        active={canvasActive}
        attract={attract}
        config={worldConfig}
        onHud={onHud}
        onRunEnd={onRunEnd}
        worldRef={worldRef}
      />

      {screen === 'playing' && (
        <Hud
          hud={hud}
          s={s}
          lang={lang}
          tools={
            <>
              <button
                type="button"
                className="lion-icon-btn lion-icon-mute"
                data-testid="lion-icon-mute"
                onClick={toggleMute}
                aria-pressed={muted}
                title={muted ? s.muteOn : s.muteOff}
                aria-label={muted ? s.muteOn : s.muteOff}
              >
                {muted ? '×♪' : '♪'}
              </button>
              <button
                type="button"
                className="lion-icon-btn lion-icon-help"
                data-testid="lion-icon-help"
                onClick={() => setShowHowTo(true)}
                title={s.howTo}
                aria-label={s.howTo}
              >
                ?
              </button>
            </>
          }
        />
      )}

      <HowToHint s={s} visible={screen === 'playing' && showHint} />

      <TouchPad
        visible={screen === 'playing'}
        mode={mode}
        s={s}
        held={hud.legHeld}
        showGetUp={hud.fallen && !hud.finished}
        combo={hud.combo}
        onBeatRatio={hud.onBeatRatio}
        beatPulse={hud.beatPulse}
        onLeg={onLeg}
        onGetUp={onGetUp}
      />

      {screen === 'playing' && stampText && hud.fallen && (
        <div className="lion-fall-stamp" aria-live="assertive">
          {stampText}
        </div>
      )}

      {screen === 'title' && (
        <div className="lion-title-shell">
          <div className="lion-title-card">
            <p className="lion-eyebrow">Clubhouse Games</p>
            <h1 className="lion-brand">{s.title}</h1>
            <p className="lion-sub">{s.subtitle}</p>

            <ol className="lion-rules">
              {s.rules.map((line, i) => (
                <li key={line}>
                  <span className="lion-rule-n">{i + 1}</span>
                  {line}
                </li>
              ))}
            </ol>

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

            <label className="lion-assist">
              <input type="checkbox" checked={assist} onChange={toggleAssist} />
              <span>
                {s.assist}
                <small>{s.assistHint}</small>
              </span>
            </label>

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
            <div className="howto-diagram" aria-hidden="true">
              <div className="howto-lion">
                <span className="howto-key howto-fl">Q</span>
                <span className="howto-key howto-fr">W</span>
                <span className="howto-key howto-bl">O</span>
                <span className="howto-key howto-br">P</span>
              </div>
              <p className="howto-rhythm">Q+P ↔ W+O</p>
            </div>
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
        <LionResult
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
              : [
                  {
                    label: s.best,
                    value: (() => {
                      const b = result.mode === '2p' ? best2p : best1p;
                      return b != null ? formatTime(b) : '—';
                    })(),
                  },
                ]),
            {
              label: s.falls,
              value: String(result.fallCount),
            },
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
    </div>
  );
}
