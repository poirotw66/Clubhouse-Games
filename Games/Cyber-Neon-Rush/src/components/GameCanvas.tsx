import { useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { createGameWorld, type GameWorld, type RunConfig } from '../engine/GameWorld';
import type { HudSnapshot, RunResult } from '../engine/scoreSystem';

interface GameCanvasProps {
  config: RunConfig;
  running: boolean;
  paused: boolean;
  onHud: (hud: HudSnapshot) => void;
  onGameOver: (result: RunResult) => void;
  worldRef: MutableRefObject<GameWorld | null>;
}

export function GameCanvas({
  config,
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

  const configKey = `${config.difficulty}:${config.cosmeticId}:${JSON.stringify(config.upgrades)}`;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const world = createGameWorld(config);
    worldRef.current = world;
    world.onHud((hud) => onHudRef.current(hud));
    world.onGameOver((result) => onGameOverRef.current(result));
    world.mount(host);
    world.start();

    return () => {
      world.unmount();
      if (worldRef.current === world) worldRef.current = null;
    };
    // Recreate world when run config identity changes (new runId remounts via key upstream).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- configKey captures relevant fields
  }, [worldRef, configKey]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world || !running) return;
    world.setPaused(paused);
  }, [paused, running, worldRef]);

  return <div ref={hostRef} className="absolute inset-0 z-0" aria-hidden="true" />;
}
