import type {ItemId, RaceState, Racer} from './race.ts';
import {rivalForChar} from '../data/rivals.ts';
import {CHARACTERS} from '../data/characters.ts';

export interface TireTelemetry {
  flTemp: number;
  frTemp: number;
  rlTemp: number;
  rrTemp: number;
  gripPct: number;
  status: 'optimal' | 'warm' | 'hot' | 'offroad';
  statusText: string;
}

export interface RacerTelemetry {
  index: number;
  charId: string;
  name: string;
  place: number;
  gapSeconds: number;
  gapToLeader: number;
  item: ItemId | null;
  itemRoll: number;
  shields: number;
  speed: number;
  tagline: string;
  isPlayer: boolean;
  finished: boolean;
  finishTime: number;
}

export interface TelemetryData {
  rpm: number;
  gear: string;
  lateralG: number;
  onRoad: boolean;
  tires: TireTelemetry;
  racers: RacerTelemetry[];
  gapAhead: number | null;
  gapBehind: number | null;
  aheadRacerName: string | null;
  behindRacerName: string | null;
  spotterMessage: string;
  spotterUrgent: boolean;
}

export const INITIAL_TIRES: TireTelemetry = {
  flTemp: 75,
  frTemp: 75,
  rlTemp: 75,
  rrTemp: 75,
  gripPct: 100,
  status: 'optimal',
  statusText: '抓地良好 100%',
};

export function updateTires(
  prev: TireTelemetry,
  player: Racer,
  onRoad: boolean,
  steer: number,
  isBraking: boolean,
  dt: number,
): TireTelemetry {
  const coolRate = 0.25;
  const targetAmbient = 75;

  let fl = prev.flTemp + (targetAmbient - prev.flTemp) * dt * coolRate;
  let fr = prev.frTemp + (targetAmbient - prev.frTemp) * dt * coolRate;
  let rl = prev.rlTemp + (targetAmbient - prev.rlTemp) * dt * coolRate;
  let rr = prev.rrTemp + (targetAmbient - prev.rrTemp) * dt * coolRate;

  const speedRatio = Math.min(1.2, player.speed / 320);
  const forwardHeat = speedRatio * 3.5 * dt;
  fl += forwardHeat;
  fr += forwardHeat;
  rl += forwardHeat;
  rr += forwardHeat;

  // Steering weight transfer and lateral friction
  if (steer < 0) {
    fr += Math.abs(steer) * 16 * dt;
    rr += Math.abs(steer) * 20 * dt;
  } else if (steer > 0) {
    fl += Math.abs(steer) * 16 * dt;
    rl += Math.abs(steer) * 20 * dt;
  }

  // Drifting friction heats rear and slide tires heavily
  if (player.drifting) {
    const driftHeat = 32 * dt;
    rl += driftHeat;
    rr += driftHeat;
    if (player.driftDir < 0) fr += 18 * dt;
    else if (player.driftDir > 0) fl += 18 * dt;
  }

  // Braking load heats front tires
  if (isBraking) {
    fl += 22 * dt;
    fr += 22 * dt;
  }

  // Clamping temperatures between 65°C and 130°C
  fl = Math.max(65, Math.min(130, fl));
  fr = Math.max(65, Math.min(130, fr));
  rl = Math.max(65, Math.min(130, rl));
  rr = Math.max(65, Math.min(130, rr));

  const maxTemp = Math.max(fl, fr, rl, rr);

  if (!onRoad) {
    return {
      flTemp: Math.round(fl),
      frTemp: Math.round(fr),
      rlTemp: Math.round(rl),
      rrTemp: Math.round(rr),
      gripPct: 52,
      status: 'offroad',
      statusText: '草地低抓地力 52%',
    };
  }

  if (maxTemp > 108) {
    return {
      flTemp: Math.round(fl),
      frTemp: Math.round(fr),
      rlTemp: Math.round(rl),
      rrTemp: Math.round(rr),
      gripPct: 84,
      status: 'hot',
      statusText: `胎溫過高 ${Math.round(maxTemp)}°C`,
    };
  }

  if (maxTemp > 92) {
    return {
      flTemp: Math.round(fl),
      frTemp: Math.round(fr),
      rlTemp: Math.round(rl),
      rrTemp: Math.round(rr),
      gripPct: 93,
      status: 'warm',
      statusText: `輪胎升溫 ${Math.round(maxTemp)}°C`,
    };
  }

  return {
    flTemp: Math.round(fl),
    frTemp: Math.round(fr),
    rlTemp: Math.round(rl),
    rrTemp: Math.round(rr),
    gripPct: 99,
    status: 'optimal',
    statusText: '抓地良好 99%',
  };
}

export function calculateRpmAndGear(
  speed: number,
  isBoosting: boolean,
  isDrifting: boolean,
): {rpm: number; gear: string} {
  if (isBoosting) {
    const pulse = Math.sin(Date.now() * 0.04) * 350;
    return {rpm: Math.round(8900 + pulse), gear: 'BOOST ⚡'};
  }

  if (isDrifting) {
    const driftRev = Math.min(8800, 7200 + (speed / 340) * 1400);
    return {rpm: Math.round(driftRev), gear: 'DRIFT 🌀'};
  }

  const s = Math.max(0, speed);
  if (s < 15) return {rpm: Math.round(950 + s * 30), gear: '1檔'};
  if (s < 85) return {rpm: Math.round(2600 + (s / 85) * 3800), gear: '1檔'};
  if (s < 170) return {rpm: Math.round(3300 + ((s - 85) / 85) * 3800), gear: '2檔'};
  if (s < 255) return {rpm: Math.round(3800 + ((s - 170) / 85) * 3800), gear: '3檔'};
  if (s < 330) return {rpm: Math.round(4400 + ((s - 255) / 75) * 3800), gear: '4檔'};
  return {rpm: Math.round(5800 + Math.min(2800, ((s - 330) / 90) * 2800)), gear: '5檔'};
}

export function calculateLateralG(
  steer: number,
  speed: number,
  drifting: boolean,
  driftDir: number,
): number {
  if (drifting) {
    return Number((driftDir * 1.65).toFixed(2));
  }
  const ratio = Math.min(1.2, speed / 300);
  return Number((steer * ratio * 1.15).toFixed(2));
}

export function buildRacerTelemetry(
  state: RaceState,
  playerIndex: number,
): {
  racers: RacerTelemetry[];
  gapAhead: number | null;
  gapBehind: number | null;
  aheadRacerName: string | null;
  behindRacerName: string | null;
} {
  const player = state.racers[playerIndex];
  const spacing = state.assets.centerline.spacing || 18;
  const avgSpeed = Math.max(140, player.speed);

  // Sort by place
  const sorted = [...state.racers].sort((a, b) => a.place - b.place);
  const leader = sorted[0];

  const results: RacerTelemetry[] = sorted.map((r) => {
    const char = CHARACTERS.find((c) => c.id === r.charId);
    const style = r.rival ?? rivalForChar(r.charId);
    const tagline = r.isPlayer ? '王牌車手' : style.tagline;

    let gapToLeader = 0;
    if (r.place === 1) {
      gapToLeader = 0;
    } else if (leader.finished && r.finished) {
      gapToLeader = Math.max(0, r.finishTime - leader.finishTime);
    } else {
      const dist = Math.max(0, (leader.progress - r.progress) * spacing);
      gapToLeader = dist / avgSpeed;
    }

    let gapSeconds = 0;
    if (r.index === player.index) {
      gapSeconds = 0;
    } else if (player.finished && r.finished) {
      gapSeconds = r.finishTime - player.finishTime;
    } else {
      const dist = (player.progress - r.progress) * spacing;
      gapSeconds = dist / avgSpeed;
    }

    return {
      index: r.index,
      charId: r.charId,
      name: char?.name ?? r.name,
      place: r.place,
      gapSeconds,
      gapToLeader,
      item: r.item,
      itemRoll: r.itemRoll,
      shields: r.shields,
      speed: r.speed,
      tagline,
      isPlayer: r.isPlayer,
      finished: r.finished,
      finishTime: r.finishTime,
    };
  });

  // Ahead / behind relative to player
  let gapAhead: number | null = null;
  let aheadRacerName: string | null = null;
  let gapBehind: number | null = null;
  let behindRacerName: string | null = null;

  const playerItem = results.find((r) => r.isPlayer);
  if (playerItem) {
    const ahead = results.find((r) => r.place === playerItem.place - 1);
    if (ahead) {
      gapAhead = ahead.gapSeconds;
      aheadRacerName = ahead.name;
    }
    const behind = results.find((r) => r.place === playerItem.place + 1);
    if (behind) {
      gapBehind = behind.gapSeconds;
      behindRacerName = behind.name;
    }
  }

  return {
    racers: results,
    gapAhead,
    gapBehind,
    aheadRacerName,
    behindRacerName,
  };
}

export function generateSpotterMessage(
  state: RaceState,
  player: Racer,
  onRoad: boolean,
  gapAhead: number | null,
  aheadRacerName: string | null,
  gapBehind: number | null,
  behindRacerName: string | null,
): {message: string; urgent: boolean} {
  if (state.phase === 'countdown') {
    return {message: '🚦 引擎暖機待命！緊盯倒數信號，起步立即全油門推進！', urgent: false};
  }

  if (state.phase === 'finished' || player.finished) {
    return {
      message: player.place === 1 ? '🏆 精彩絕倫！勇奪分站冠軍，完美衝線！' : '🏁 完賽衝線！感謝全體車隊技師辛勞！',
      urgent: false,
    };
  }

  // Incoming homing missile alert
  const incomingHoming = state.homings.some((h) => h.target === player.index);
  if (incomingHoming) {
    return {
      message: '🚨 飛彈警報！偵測到追蹤飛磚鎖定！若持有護盾請即刻展開防禦！',
      urgent: true,
    };
  }

  // Nearby oil hazard alert
  const nearOil = state.oils.some((o) => Math.hypot(o.x - player.x, o.y - player.y) < 170);
  if (nearOil) {
    return {message: '⚠️ 前方賽道油漬警報！注意調整切線，切勿輾壓失控！', urgent: true};
  }

  // Off-road草地警告
  if (!onRoad) {
    return {
      message: '⚠️ 脫離賽車線！草地嚴重失速中，立即修正轉向重返賽道！',
      urgent: true,
    };
  }

  // Slipstream draft notification
  if (player.slipstream > 0.3) {
    return {
      message: '🔥 吸入前車尾流真空！極速突破中，抓住時機外切抽頭超車！',
      urgent: false,
    };
  }

  // Drift boost ready
  if (player.drifting) {
    if (player.driftCharge >= 2.0) {
      return {
        message: '💥 MAX 紫色三級渦輪蓄滿！出彎瞬間鬆開甩尾鍵，釋放極致狂暴噴射！',
        urgent: true,
      };
    }
    if (player.driftCharge >= 1.2) {
      return {message: '⚡ 橘色二級渦輪充能完畢！準備出彎加速！', urgent: false};
    }
    if (player.driftCharge >= 0.5) {
      return {message: '⚡ 藍色初級小噴充能就緒！', urgent: false};
    }
  }

  // Behind rival holding homing weapon
  const rivalBehind = state.racers.find((r) => r.place === player.place + 1);
  if (rivalBehind && rivalBehind.item === 'homing') {
    return {
      message: `⚠️ 威脅雷達：後方 ${behindRacerName ?? '對手'} 持有追蹤飛磚，提高警覺！`,
      urgent: true,
    };
  }

  // Gap delta tactical instructions
  if (player.place === 1) {
    if (gapBehind != null && Math.abs(gapBehind) < 0.65) {
      return {
        message: `⏱️ 後車 ${behindRacerName ?? ''} 緊咬（秒差僅 +${Math.abs(gapBehind).toFixed(2)}s）！死守彎道內線！`,
        urgent: true,
      };
    }
    return {message: '🏁 穩健領跑中！維持最佳切彎路線與平穩油門！', urgent: false};
  }

  if (gapAhead != null && Math.abs(gapAhead) < 0.8) {
    return {
      message: `🏎️ 距離前車 ${aheadRacerName ?? ''} 僅差 ${Math.abs(gapAhead).toFixed(2)}s！貼緊尾流準備超車！`,
      urgent: false,
    };
  }

  if (player.lap === state.laps) {
    return {message: '🔔 進入最終圈決勝時刻！全油門衝刺，爭奪頒獎台！', urgent: false};
  }

  return {message: '💡 提示：彎道按住 Shift / C 甩尾蓄力，放開即可觸發渦輪小噴！', urgent: false};
}

export function computeTelemetry(
  state: RaceState,
  playerIndex: number,
  prevTires: TireTelemetry,
  steer: number,
  isBraking: boolean,
  onRoad: boolean,
  dt: number,
): TelemetryData {
  const player = state.racers[playerIndex];

  const tires = updateTires(prevTires, player, onRoad, steer, isBraking, dt);
  const {rpm, gear} = calculateRpmAndGear(
    player.speed,
    player.boostTime > 0,
    player.drifting,
  );
  const lateralG = calculateLateralG(
    steer,
    player.speed,
    player.drifting,
    player.driftDir,
  );

  const {racers, gapAhead, gapBehind, aheadRacerName, behindRacerName} =
    buildRacerTelemetry(state, playerIndex);

  const spotter = generateSpotterMessage(
    state,
    player,
    onRoad,
    gapAhead,
    aheadRacerName,
    gapBehind,
    behindRacerName,
  );

  return {
    rpm,
    gear,
    lateralG,
    onRoad,
    tires,
    racers,
    gapAhead,
    gapBehind,
    aheadRacerName,
    behindRacerName,
    spotterMessage: spotter.message,
    spotterUrgent: spotter.urgent,
  };
}
