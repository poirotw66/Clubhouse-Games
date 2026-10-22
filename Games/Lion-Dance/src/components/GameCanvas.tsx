import { useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { createLionWorld, type HudSnapshot, type LionWorld, type RunResult } from '../engine/LionWorld';

interface GameCanvasProps {
  runId: number;
  playing: boolean;
  onHud: (hud: HudSnapshot) => void;
  onRunEnd: (result: RunResult) => void;
  worldRef: MutableRefObject<LionWorld | null>;
}

export function GameCanvas({
  runId,
  playing,
  onHud,
  onRunEnd,
  worldRef,
}: GameCanvasProps): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const onHudRef = useRef(onHud);
  const onEndRef = useRef(onRunEnd);
  onHudRef.current = onHud;
  onEndRef.current = onRunEnd;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const world = createLionWorld();
    worldRef.current = world;
    world.onHud((hud) => onHudRef.current(hud));
    world.onRunEnd((result) => onEndRef.current(result));
    world.mount(host);
    return () => {
      world.unmount();
      if (worldRef.current === world) worldRef.current = null;
    };
  }, [worldRef, runId]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    if (playing) world.start();
    else world.setPaused(true);
  }, [playing, runId, worldRef]);

  return <div ref={hostRef} className="absolute inset-0 z-0" aria-hidden="true" />;
}
