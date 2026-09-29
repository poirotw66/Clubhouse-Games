import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { playGoal, playLose, playWin } from '@clubhouse/shared/synthAudio';
import {
  applyChallengeResult,
  challengeById,
  challengeIndexById,
  isChallengeCleared,
} from './game/challenges';
import type { CareerChallenge } from './game/challenges';
import { POSITIONS } from './game/config';
import { acknowledge, createGame, resolve } from './game/engine';
import { normalizeSeedCode, randomSeedCode } from './game/rng';
import { evaluate } from './game/achievements';
import type { Achievement, AchievementProgress } from './game/achievements';
import {
  clearGame,
  loadAchievements,
  loadActiveChallengeId,
  loadArchive,
  loadChallengeProgress,
  loadGame,
  pushArchive,
  saveAchievements,
  saveActiveChallengeId,
  saveChallengeProgress,
  saveGame,
} from './game/storage';
import type { ArchiveEntry } from './game/storage';
import type { ChallengeProgress } from './game/challenges';
import type { GameState, Position } from './game/types';
import { CreateScreen } from './components/CreateScreen';
import {
  FirstRunGuide,
  hasSeenFirstRunGuide,
} from './components/FirstRunGuide';
import { PlayScreen } from './components/PlayScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { TitleScreen } from './components/TitleScreen';

type Screen = 'title' | 'create' | 'play' | 'summary';

/** `?seed=64aa2bl7` opens the title screen on someone else's world. */
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
  // Undo stack. This is safe rather than a re-roll: `rng()` in the engine seeds
  // every random draw on (purpose, turnIndex, choices.length), so stepping back
  // and picking the *same* option reproduces the identical outcome. It undoes a
  // misclick, not a bad roll.
  const [history, setHistory] = useState<GameState[]>([]);
  const [saved, setSaved] = useState<GameState | null>(() => loadGame());
  const [archive, setArchive] = useState<ArchiveEntry[]>(() => loadArchive());
  const [achievements, setAchievements] = useState<AchievementProgress>(() => loadAchievements());
  const [challengeProgress, setChallengeProgress] = useState<ChallengeProgress>(() =>
    loadChallengeProgress(),
  );
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(() =>
    loadActiveChallengeId(),
  );
  const [challengeResult, setChallengeResult] = useState<boolean | null>(null);
  const [justUnlocked, setJustUnlocked] = useState<Achievement[]>([]);
  const [showFirstRun, setShowFirstRun] = useState(() => !hasSeenFirstRunGuide());
  const summarySfxKey = useRef<string | null>(null);

  const activeChallenge: CareerChallenge | null = activeChallengeId
    ? (challengeById(activeChallengeId) ?? null)
    : null;

  // Persist after every turn so a closed tab does not cost a career.
  useEffect(() => {
    if (state && !state.retired) saveGame(state);
  }, [state]);

  // Screens are swapped in place, so the window keeps whatever scroll position
  // the last one left behind. The buttons that move between screens sit at the
  // bottom of long pages, which meant the next screen opened part-way down with
  // its header scrolled off above the viewport.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // Career summary keeps its own long-form UI (not ResultOverlay); still share
  // suite SFX so retirement lands with the same feedback as other games.
  useEffect(() => {
    if (screen !== 'summary' || !state?.summary) {
      if (screen !== 'summary') summarySfxKey.current = null;
      return;
    }
    const key = `${state.seedCode}:${state.summary.hofScore}:${state.summary.verdict}:${challengeResult ?? 'free'}`;
    if (summarySfxKey.current === key) return;
    summarySfxKey.current = key;
    if (activeChallenge && challengeResult !== null) {
      if (challengeResult) playWin();
      else playLose();
      return;
    }
    const hof = state.summary.hofScore;
    if (hof >= 1450) playWin();
    else if (hof >= 380) playGoal();
    else playLose();
  }, [screen, state, activeChallenge, challengeResult]);

  const finish = useCallback(
    (finished: GameState) => {
      if (!finished.summary) return;
      setArchive(
        pushArchive({
          seedCode: finished.seedCode,
          name: finished.name,
          position: POSITIONS.find((p) => p.id === finished.position)?.label ?? finished.position,
          verdict: finished.summary.verdict,
          hofScore: finished.summary.hofScore,
          traits: finished.traits,
        }),
      );
      // Achievements read the freshly loaded progress rather than component state
      // so that a second tab finishing a career cannot silently roll this one back.
      const result = evaluate(finished, loadAchievements());
      saveAchievements(result.progress);
      setAchievements(result.progress);
      setJustUnlocked(result.unlocked);

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
    },
    [],
  );

  const beginFreePlay = useCallback((code: string) => {
    saveActiveChallengeId(null);
    setActiveChallengeId(null);
    setChallengeResult(null);
    setSeedCode(code);
    setScreen('create');
  }, []);

  const beginChallenge = useCallback((challengeId: string) => {
    const challenge = challengeById(challengeId);
    if (!challenge) return;
    saveActiveChallengeId(challenge.id);
    setActiveChallengeId(challenge.id);
    setChallengeResult(null);
    setSeedCode(challenge.seedCode);
    setScreen('create');
  }, []);

  const handleCreate = useCallback(
    (input: { name: string; position: Position; originId: string }) => {
      const challenge = activeChallengeId ? challengeById(activeChallengeId) : null;
      const position = challenge?.position ?? input.position;
      const code = challenge?.seedCode ?? seedCode;
      setSeedCode(code);
      setState(createGame({ seedCode: code, ...input, position }));
      setHistory([]);
      setScreen('play');
    },
    [seedCode, activeChallengeId],
  );

  const handleChoose = useCallback(
    (optionId: string, useDestiny = false) => {
      if (!state) return;
      // Twenty steps is well over a high-school year of turns — enough to walk
      // back a mistake, bounded so a full career does not hold forty-plus
      // complete game states.
      setHistory((prev) => [...prev.slice(-19), state]);
      setState(resolve(state, optionId, useDestiny));
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

  // Deliberately not a functional setState: archiving and screen changes are
  // side effects, and StrictMode runs updaters twice, which would file the
  // finished career into the archive twice over.
  const handleAcknowledge = useCallback(() => {
    if (!state) return;
    // The retirement report is the last thing to read before the summary.
    if (state.retired) {
      finish(state);
      setScreen('summary');
      return;
    }
    setState(acknowledge(state));
  }, [state, finish]);

  const backToTitle = useCallback(() => {
    clearGame();
    saveActiveChallengeId(null);
    setSaved(null);
    setState(null);
    setHistory([]);
    setActiveChallengeId(null);
    setChallengeResult(null);
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
    setState(null);
    setHistory([]);
    setChallengeResult(null);
    setSeedCode(challenge.seedCode);
    saveActiveChallengeId(challenge.id);
    setScreen('create');
  }, [activeChallengeId, backToTitle]);

  return (
    <>
      <BackToMenu />
      {showFirstRun && <FirstRunGuide onClose={() => setShowFirstRun(false)} />}
      {screen === 'title' && (
        <TitleScreen
          initialSeed={seedCode}
          hasSave={saved !== null}
          archive={archive}
          achievements={achievements}
          challengeProgress={challengeProgress}
          onShowHowTo={() => setShowFirstRun(true)}
          onStart={beginFreePlay}
          onStartChallenge={beginChallenge}
          onContinue={() => {
            if (!saved) return;
            setState(saved);
            setHistory([]);
            setSeedCode(saved.seedCode);
            setActiveChallengeId(loadActiveChallengeId());
            setChallengeResult(null);
            setScreen('play');
          }}
        />
      )}

      {screen === 'create' && (
        <CreateScreen
          seedCode={seedCode}
          challenge={activeChallenge}
          onCreate={handleCreate}
          onBack={() => {
            saveActiveChallengeId(null);
            setActiveChallengeId(null);
            setScreen('title');
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
          onQuit={backToTitle}
        />
      )}

      {screen === 'summary' && state && (
        <SummaryScreen
          state={state}
          unlocked={justUnlocked}
          challenge={activeChallenge}
          challengeCleared={challengeResult}
          onRestart={backToTitle}
          onSameSeed={() => {
            saveActiveChallengeId(null);
            setActiveChallengeId(null);
            setChallengeResult(null);
            setState(null);
            setScreen('create');
          }}
          onRetryChallenge={activeChallenge ? retryChallenge : undefined}
        />
      )}
    </>
  );
}
