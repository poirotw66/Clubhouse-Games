import React, { useCallback, useEffect, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { POSITIONS } from './game/config';
import { acknowledge, createGame, resolve } from './game/engine';
import { normalizeSeedCode, randomSeedCode } from './game/rng';
import { evaluate } from './game/achievements';
import type { Achievement, AchievementProgress } from './game/achievements';
import {
  clearGame,
  loadAchievements,
  loadArchive,
  loadGame,
  pushArchive,
  saveAchievements,
  saveGame,
} from './game/storage';
import type { ArchiveEntry } from './game/storage';
import type { GameState, Position } from './game/types';
import { CreateScreen } from './components/CreateScreen';
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
  const [justUnlocked, setJustUnlocked] = useState<Achievement[]>([]);

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

  const finish = useCallback((finished: GameState) => {
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
    clearGame();
    setSaved(null);
  }, []);

  const handleCreate = useCallback(
    (input: { name: string; position: Position; originId: string }) => {
      setState(createGame({ seedCode, ...input }));
      setHistory([]);
      setScreen('play');
    },
    [seedCode],
  );

  const handleChoose = useCallback(
    (optionId: string) => {
      if (!state) return;
      // Twenty steps is well over a high-school year of turns — enough to walk
      // back a mistake, bounded so a full career does not hold forty-plus
      // complete game states.
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
    setSaved(null);
    setState(null);
    setHistory([]);
    setSeedCode(randomSeedCode());
    setScreen('title');
  }, []);

  return (
    <>
      <BackToMenu />
      {screen === 'title' && (
        <TitleScreen
          initialSeed={seedCode}
          hasSave={saved !== null}
          archive={archive}
          achievements={achievements}
          onStart={(code) => {
            setSeedCode(code);
            setScreen('create');
          }}
          onContinue={() => {
            if (!saved) return;
            setState(saved);
            setHistory([]);
            setSeedCode(saved.seedCode);
            setScreen('play');
          }}
        />
      )}

      {screen === 'create' && (
        <CreateScreen seedCode={seedCode} onCreate={handleCreate} onBack={() => setScreen('title')} />
      )}

      {screen === 'play' && state && (
        <PlayScreen
          state={state}
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
          onRestart={backToTitle}
          onSameSeed={() => {
            setState(null);
            setScreen('create');
          }}
        />
      )}
    </>
  );
}
