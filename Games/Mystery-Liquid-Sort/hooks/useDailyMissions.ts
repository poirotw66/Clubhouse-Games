import { useMemo, useState } from 'react';
import { DailyMission, MissionType } from '../types';
import { loadDailyMissions, updateMissionProgress, hasUnclaimedRewards, claimMissionReward } from '../services/missionService';

type UseDailyMissionsOptions = {
  currentCoins?: number;
};

type UseDailyMissionsResult = {
  missions: DailyMission[];
  hasNotifications: boolean;
  trackMissionProgress: (type: MissionType, amount?: number) => void;
  claimMission: (missionId: string) => number;
};

export const useDailyMissions = (options: UseDailyMissionsOptions = {}): UseDailyMissionsResult => {
  const { currentCoins = 0 } = options;
  const [missions, setMissions] = useState<DailyMission[]>(() => loadDailyMissions());

  const hasNotifications = useMemo(() => hasUnclaimedRewards(missions), [missions]);

  const trackMissionProgress = (type: MissionType, amount: number = 1) => {
    setMissions(prev => updateMissionProgress(prev, type, amount));
  };

  const claimMission = (missionId: string): number => {
    const result = claimMissionReward(missions, missionId, currentCoins);
    setMissions(result.missions);
    return result.coinsDelta;
  };

  return {
    missions,
    hasNotifications,
    trackMissionProgress,
    claimMission,
  };
};
