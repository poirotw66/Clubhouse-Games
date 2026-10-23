import { useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import {
  createLionWorld,
  type HudSnapshot,
  type LionWorld,
  type RunResult,
  type WorldConfig,
} from '../engine/LionWorld';

interface GameCanvasProps {
  runId: number;
  /** Title attract idle or active play. */
  active: boolean;
  attract: boolean;
  config: WorldConfig;
  onHud: (hud: HudSnapshot) => void;
  onRunEnd: (result: RunResult) => void;
  worldRef: MutableRefObject<LionWorld | null>;
}

export function GameCanvas({
  runId,
  active,
  attract,
  config,
  onHud,
  onRunEnd,
  worldRef,
}: GameCanvasProps): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const onHudRef = useRef(onHud);
  const onEndRef = useRef(onRunEnd);
  const configRef = useRef(config);
  onHudRef.current = onHud;
  onEndRef.current = onRunEnd;
  configRef.current = config;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const world = createLionWorld();
    worldRef.current = world;
    // Expose for Playwright framing / automation checks
    (window as Window & { __lionWorld?: LionWorld }).__lionWorld = world;
    world.onHud((hud) => onHudRef.current(hud));
    world.onRunEnd((result) => onEndRef.current(result));
    world.mount(host);
    world.start({ ...configRef.current, attract: true });
    return () => {
      world.unmount();
      const w = window as Window & { __lionWorld?: LionWorld };
      if (w.__lionWorld === world) delete w.__lionWorld;
      if (worldRef.current === world) worldRef.current = null;
    };
  }, [worldRef]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    if (!active) {
      world.setPaused(true);
      return;
    }
    world.start({ ...configRef.current, attract });
  }, [active, attract, runId, worldRef]);

  useEffect(() => {
    worldRef.current?.setMuted(config.muted);
  }, [config.muted, worldRef]);

  useEffect(() => {
    worldRef.current?.setAssist(config.assist);
  }, [config.assist, worldRef]);

  return <div ref={hostRef} className="absolute inset-0 z-0" aria-hidden="true" />;
}
