import { useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { createGameWorld, type GameWorld } from '../engine/GameWorld';
import type { HudSnapshot, RunResult } from '../engine/scoreSystem';

interface GameCanvasProps {
  running: boolean;
  paused: boolean;
  onHud: (hud: HudSnapshot) => void;
  onGameOver: (result: RunResult) => void;
  worldRef: MutableRefObject<GameWorld | null>;
}

export function GameCanvas({
  running,
  paused,
  onHud,
  onGameOver,
  worldRef,
}: GameCanvasProps): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const world = createGameWorld();
    worldRef.current = world;
    world.onHud(onHud);
    world.onGameOver(onGameOver);
    world.mount(host);
    return () => {
      world.unmount();
      worldRef.current = null;
    };
    // Mount once; callbacks read via refs below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.onHud(onHud);
    world.onGameOver(onGameOver);
  }, [onHud, onGameOver, worldRef]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world || !running) return;
    world.start();
  }, [running, worldRef]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world || !running) return;
    world.setPaused(paused);
  }, [paused, running, worldRef]);

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 z-0"
      aria-hidden="true"
    />
  );
}
