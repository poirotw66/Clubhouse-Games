import { useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { createGameWorld, type GameWorld } from '../engine/GameWorld';
import type { RushDifficulty } from '../engine/constants';
import type { HudSnapshot, RunResult } from '../engine/scoreSystem';

interface GameCanvasProps {
  difficulty: RushDifficulty;
  running: boolean;
  paused: boolean;
  onHud: (hud: HudSnapshot) => void;
  onGameOver: (result: RunResult) => void;
  worldRef: MutableRefObject<GameWorld | null>;
}

export function GameCanvas({
  difficulty,
  running,
  paused,
  onHud,
  onGameOver,
  worldRef,
}: GameCanvasProps): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const onHudRef = useRef(onHud);
  const onGameOverRef = useRef(onGameOver);
  onHudRef.current = onHud;
  onGameOverRef.current = onGameOver;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const world = createGameWorld(difficulty);
    worldRef.current = world;
    world.onHud((hud) => onHudRef.current(hud));
    world.onGameOver((result) => onGameOverRef.current(result));
    world.mount(host);
    world.start();

    return () => {
      world.unmount();
      if (worldRef.current === world) worldRef.current = null;
    };
  }, [worldRef, difficulty]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world || !running) return;
    world.setPaused(paused);
  }, [paused, running, worldRef]);

  return <div ref={hostRef} className="absolute inset-0 z-0" aria-hidden="true" />;
}
