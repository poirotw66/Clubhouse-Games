import type { ReactElement } from 'react';
import type { HudSnapshot } from '../engine/scoreSystem';
import { CockpitHud } from './CockpitHud';

interface ScoreboardProps {
  hud: HudSnapshot;
  visible: boolean;
  onOpenLore?: () => void;
}

export function Scoreboard({ hud, visible, onOpenLore }: ScoreboardProps): ReactElement | null {
  return <CockpitHud hud={hud} visible={visible} onOpenLore={onOpenLore} />;
}
