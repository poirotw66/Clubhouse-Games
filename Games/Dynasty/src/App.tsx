import React, { useCallback, useEffect, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { CLUBS } from './game/config';
import { acknowledge, createGame, resolve } from './game/engine';
import { normalizeSeedCode, randomSeedCode } from './game/rng';
import { clearGame, loadArchive, loadGame, pushArchive, saveGame } from './game/storage';
import type { ArchiveEntry } from './game/storage';
import type { GameState } from './game/types';
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
          onStart={(code, gmName, teamId) => {
            setSeedCode(code);
            setState(createGame({ seedCode: code, gmName, teamId }));
            setHistory([]);
            setScreen('play');
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

      {screen === 'summary' && state && <SummaryScreen state={state} onRestart={backToTitle} />}
    </>
  );
}
