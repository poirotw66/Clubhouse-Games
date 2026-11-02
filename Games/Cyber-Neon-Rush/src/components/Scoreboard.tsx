import type { ReactElement } from 'react';
import type { HudSnapshot } from '../engine/scoreSystem';
import { CockpitHud } from './CockpitHud';

interface ScoreboardProps {
  hud: HudSnapshot;
  visible: boolean;
}

export function Scoreboard({ hud, visible }: ScoreboardProps): ReactElement | null {
  return <CockpitHud hud={hud} visible={visible} />;
}
