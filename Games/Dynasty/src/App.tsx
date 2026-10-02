import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { playGoal, playLose, playWin } from '@clubhouse/shared/synthAudio';
import {
  applyChallengeResult,
  challengeById,
  challengeIndexById,
  isChallengeCleared,
} from './game/challenges';
import type { CareerChallenge, ChallengeProgress } from './game/challenges';
import { CLUBS } from './game/config';
import { acknowledge, createGame, resolve } from './game/engine';
import { applyTenureToRecords } from './game/records';
import type { PersonalRecords } from './game/records';
import { normalizeSeedCode, randomSeedCode } from './game/rng';
import {
  clearGame,
  loadActiveChallengeId,
  loadArchive,
  loadChallengeProgress,
  loadGame,
  loadRecords,
  pushArchive,
  saveActiveChallengeId,
  saveChallengeProgress,
  saveGame,
  saveRecords,
} from './game/storage';
import type { ArchiveEntry } from './game/storage';
import type { GameState } from './game/types';
import {
  FirstRunGuide,
  hasSeenFirstRunGuide,
} from './components/FirstRunGuide';
import { PlayScreen } from './components/PlayScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { TitleScreen } from './components/TitleScreen';

type Screen = 'title' | 'play' | 'summary';

/** `?seed=dyn2026a` opens the title screen on someone else's league. */
function seedFromUrl(): string {
  try {
    const param = new URLSearchParams(window.location.search).get('seed');
    return param ? normalizeSeedCode(param) : randomSeedCode();
  } catch {
    return randomSeedCode();
  }
}

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('title');
  const [seedCode, setSeedCode] = useState(seedFromUrl);
  const [state, setState] = useState<GameState | null>(null);
  // Undo stack. This is safe rather than a re-roll: the engine seeds every
  // random draw on (purpose, year, phase, block, decisions.length), so stepping
  // back and picking the *same* option reproduces the identical outcome. It
  // undoes a misclick, not a bad roll.
  const [history, setHistory] = useState<GameState[]>([]);
  const [saved, setSaved] = useState<GameState | null>(() => loadGame());
  const [archive, setArchive] = useState<ArchiveEntry[]>(() => loadArchive());
  const [challengeProgress, setChallengeProgress] = useState<ChallengeProgress>(() =>
    loadChallengeProgress(),
  );
  const [records, setRecords] = useState<PersonalRecords>(() => loadRecords());
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(() =>
    loadActiveChallengeId(),
  );
  const [challengeResult, setChallengeResult] = useState<boolean | null>(null);
  const [showFirstRun, setShowFirstRun] = useState(() => !hasSeenFirstRunGuide());
  const summarySfxKey = useRef<string | null>(null);

  const activeChallenge: CareerChallenge | null = useMemo(
    () => (activeChallengeId ? (challengeById(activeChallengeId) ?? null) : null),
    [activeChallengeId],
  );

  // Persist after every decision so a closed tab does not cost a tenure.
  useEffect(() => {
    if (state && !state.over) saveGame(state);
  }, [state]);

  // The "接下總管職務" button sits at the bottom of a long title page, so the
  // window is still scrolled down when the next screen mounts — which parks the
  // new header underneath the floating back-to-menu pill.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // Tenure summary is a long-form page (not ResultOverlay); shared SFX still
  // mark win / mid / fired outcomes so the suite feedback bar is met.
  useEffect(() => {
    if (screen !== 'summary' || !state?.summary) {
      if (screen !== 'summary') summarySfxKey.current = null;
      return;
    }
    const key = `${state.seedCode}:${state.summary.score}:${state.summary.verdict}:${challengeResult ?? 'free'}`;
    if (summarySfxKey.current === key) return;
    summarySfxKey.current = key;
    if (activeChallenge && challengeResult !== null) {
      if (challengeResult) playWin();
      else playLose();
      return;
    }
    if (state.summary.fired) {
      playLose();
      return;
    }
    const score = state.summary.score;
    if (score >= 1900) playWin();
    else if (score >= 500) playGoal();
    else playLose();
  }, [screen, state, activeChallenge, challengeResult]);

  const finish = useCallback((finished: GameState) => {
    if (!finished.summary) return;
    setArchive(
      pushArchive({
        seedCode: finished.seedCode,
        gmName: finished.gmName,
        club: CLUBS.find((c) => c.id === finished.teamId)?.name ?? finished.teamId,
        verdict: finished.summary.verdict,
        score: finished.summary.score,
        titles: finished.summary.titles,
      }),
    );
    const nextRecords = applyTenureToRecords(finished, loadRecords());
    saveRecords(nextRecords);
    setRecords(nextRecords);

    const challengeId = loadActiveChallengeId();
    const challenge = challengeId ? challengeById(challengeId) : undefined;
    if (challenge) {
      const index = challengeIndexById(challenge.id);
      const applied = applyChallengeResult(loadChallengeProgress(), index, finished);
      saveChallengeProgress(applied.progress);
      setChallengeProgress(applied.progress);
      setChallengeResult(applied.cleared || isChallengeCleared(challenge, finished));
    } else {
      setChallengeResult(null);
    }

    clearGame();
    setSaved(null);
  }, []);

  const handleChoose = useCallback(
    (optionId: string) => {
      if (!state) return;
      // Twenty steps is a season and a half — enough to walk back a mistake,
      // bounded so a ten-year tenure does not hold forty full league states.
      setHistory((prev) => [...prev.slice(-19), state]);
      setState(resolve(state, optionId));
    },
    [state],
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      setState(prev[prev.length - 1]);
      return prev.slice(0, -1);
    });
  }, []);

  // Not a functional setState: archiving and screen changes are side effects,
  // and StrictMode runs updaters twice.
  const handleAcknowledge = useCallback(() => {
    if (!state) return;
    if (state.over) {
      finish(state);
      setScreen('summary');
      return;
    }
    setState(acknowledge(state));
  }, [state, finish]);

  const beginFreePlay = useCallback((code: string, gmName: string, teamId: string) => {
    const normalized = normalizeSeedCode(code);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('seed', normalized);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
    saveActiveChallengeId(null);
    setActiveChallengeId(null);
    setChallengeResult(null);
    setSeedCode(normalized);
    setState(createGame({ seedCode: normalized, gmName, teamId, challengeId: null }));
    setHistory([]);
    setScreen('play');
  }, []);

  const beginChallenge = useCallback((challengeId: string, gmName: string) => {
    const challenge = challengeById(challengeId);
    if (!challenge) return;
    saveActiveChallengeId(challenge.id);
    setActiveChallengeId(challenge.id);
    setChallengeResult(null);
    setSeedCode(challenge.seedCode);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('seed', challenge.seedCode);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
    setState(
      createGame({
        seedCode: challenge.seedCode,
        gmName,
        teamId: challenge.teamId,
        challengeId: challenge.id,
      }),
    );
    setHistory([]);
    setScreen('play');
  }, []);

  const backToTitle = useCallback(() => {
    clearGame();
    setSaved(null);
    setState(null);
    setHistory([]);
    setSeedCode(randomSeedCode());
    setScreen('title');
  }, []);

  const retryChallenge = useCallback(() => {
    if (!activeChallengeId) {
      backToTitle();
      return;
    }
    const challenge = challengeById(activeChallengeId);
    if (!challenge) {
      backToTitle();
      return;
    }
    const gmName = state?.gmName ?? '';
    setChallengeResult(null);
    setSeedCode(challenge.seedCode);
    saveActiveChallengeId(challenge.id);
    setState(
      createGame({
        seedCode: challenge.seedCode,
        gmName,
        teamId: challenge.teamId,
        challengeId: challenge.id,
      }),
    );
    setHistory([]);
    setScreen('play');
  }, [activeChallengeId, backToTitle, state?.gmName]);

  return (
    <>
      <BackToMenu />
      {showFirstRun && <FirstRunGuide onClose={() => setShowFirstRun(false)} />}
      {screen === 'title' && (
        <TitleScreen
          initialSeed={seedCode}
          hasSave={saved !== null}
          archive={archive}
          challengeProgress={challengeProgress}
          records={records}
          onShowHowTo={() => setShowFirstRun(true)}
          onStart={beginFreePlay}
          onStartChallenge={beginChallenge}
          onContinue={() => {
            if (!saved) return;
            setState(saved);
            setHistory([]);
            setSeedCode(saved.seedCode);
            setActiveChallengeId(loadActiveChallengeId() ?? saved.challengeId);
            setChallengeResult(null);
            setScreen('play');
          }}
        />
      )}

      {screen === 'play' && state && (
        <PlayScreen
          state={state}
          challenge={activeChallenge}
          onChoose={handleChoose}
          onAcknowledge={handleAcknowledge}
          onUndo={handleUndo}
          canUndo={history.length > 0}
          onQuit={() => {
            saveActiveChallengeId(null);
            setActiveChallengeId(null);
            setChallengeResult(null);
            backToTitle();
          }}
        />
      )}

      {screen === 'summary' && state && (
        <SummaryScreen
          state={state}
          challenge={activeChallenge}
          challengeCleared={challengeResult}
          onRestart={() => {
            saveActiveChallengeId(null);
            setActiveChallengeId(null);
            setChallengeResult(null);
            backToTitle();
          }}
          onRetryChallenge={activeChallenge ? retryChallenge : undefined}
        />
      )}
    </>
  );
}
