import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { GameCanvas } from './components/GameCanvas';
import { Hud } from './components/Hud';
import { TouchPad } from './components/TouchPad';
import { GAME_PATH, TRACK_LENGTH, type LegId } from './engine/constants';
import type { HudSnapshot, LionWorld, RunResult } from './engine/LionWorld';
import {
  loadBestTime,
  loadLang,
  saveBestTime,
  saveLang,
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
};

export default function App(): ReactElement {
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [screen, setScreen] = useState<Screen>('title');
  const [runId, setRunId] = useState(0);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [best, setBest] = useState<number | null>(() => loadBestTime());
  const [result, setResult] = useState<RunResult | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const worldRef = useRef<LionWorld | null>(null);
  const s = t(lang);

  const onHud = useCallback((next: HudSnapshot) => setHud(next), []);

  const onRunEnd = useCallback((r: RunResult) => {
    setResult(r);
    setScreen('result');
    if (r.reason === 'finish') {
      const saved = saveBestTime(r.elapsed);
      setBest(loadBestTime());
      setIsNewBest(saved === r.elapsed);
    } else {
      setIsNewBest(false);
    }
  }, []);

  const startRun = useCallback(() => {
    setResult(null);
    setHud(EMPTY_HUD);
    setIsNewBest(false);
    setRunId((n) => n + 1);
    setScreen('playing');
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next: Lang = prev === 'zh' ? 'en' : 'zh';
      saveLang(next);
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
    const text =
      result.reason === 'finish'
        ? s.shareWin(s.ranks[rank.id], formatTime(result.elapsed))
        : s.shareLose(formatDistance(result.distance, lang));
    shareToX(text, url);
  }, [result, rank, s, lang]);

  const resultVariant = result?.reason === 'finish' ? 'win' : 'lose';

  return (
    <div className="lion-app">
      <BackToMenu />
      <GameCanvas
        runId={runId}
        playing={screen === 'playing'}
        onHud={onHud}
        onRunEnd={onRunEnd}
        worldRef={worldRef}
      />

      {screen === 'playing' && <Hud hud={hud} s={s} lang={lang} best={best} />}

      <TouchPad
        visible={screen === 'playing'}
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
            <p className="lion-best-line">
              {s.best}：{best != null ? formatTime(best) : s.noBest}
            </p>
            <button type="button" className="lion-cta" onClick={startRun}>
              {s.start}
            </button>
            <button type="button" className="lion-cta-ghost" onClick={() => setShowHowTo(true)}>
              {s.howTo}
            </button>
            <button type="button" className="lion-lang" onClick={toggleLang}>
              {s.langToggle}
            </button>
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
              ? `${formatTime(result.elapsed)}${isNewBest ? (lang === 'zh' ? ' · 新紀錄！' : ' · New best!') : ''}`
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
          ]}
          primaryLabel={s.playAgain}
          onPrimary={startRun}
          secondaryLabel={s.share}
          onSecondary={share}
          variant={resultVariant}
        />
      )}

      {screen === 'title' && (
        <div className="lion-desktop-hint hidden md:block" aria-hidden="true">
          Q W O P · R
        </div>
      )}
    </div>
  );
}
