// Telemetry, biometrics, kinetic impact physics, and tactical intel for the Championship Cockpit.

import type { CharacterId } from './characters.ts';
import type { AttackKind, Height } from './combat.ts';
import { getOpponent, OPPONENTS, type OpponentId } from './opponents.ts';

export interface GForceTelemetry {
  currentGForce: number;
  peakGForce: number;
  strikeSpeedMs: number;
  lastPunchKind: AttackKind | null;
  lastPunchHeight: Height | null;
  kineticRating: 'S' | 'A' | 'B' | 'C' | '-';
}

export type StrikeOutcomeType =
  | 'hit'
  | 'counter'
  | 'parry'
  | 'blocked'
  | 'wrong_guard'
  | 'dodged';

export interface StrikeRecord {
  id: string;
  timestamp: number;
  kind: AttackKind;
  height: Height;
  outcome: StrikeOutcomeType;
  gForce: number;
  damage: number;
}

export interface TacticalRadarStats {
  aggression: number;
  defense: number;
  speed: number;
  power: number;
}

export interface TacticalOpponentIntel {
  opponentId: string;
  name: string;
  tagline: string;
  styleBadge: string;
  styleCategory:
    | 'rushdown'
    | 'counter'
    | 'outboxer'
    | 'trickster'
    | 'body_puncher'
    | 'all_rounder';
  styleDescription: string;
  signatureName: string;
  signatureBlurb: string;
  signatureTelegraph: string;
  signatureCounterMeasure: string;
  radarStats: TacticalRadarStats;
  tacticalAdvices: string[];
}

export interface MasterCoachHint {
  text: string;
  tone: 'opportunity' | 'danger' | 'warning' | 'info';
  badge: string;
}

/** Compute dynamic kinetic G-Force and velocity for punches. */
export function calculatePunchGForce(
  kind: AttackKind,
  power: number,
  isSuper: boolean,
  isCounter: boolean,
): { gForce: number; speedMs: number; rating: 'S' | 'A' | 'B' | 'C' } {
  let baseG = 14.5;
  let baseSpeed = 16.5;

  if (kind === 'jab') {
    baseG = 13.0 + power * 3.2;
    baseSpeed = 18.0 * power;
  } else if (kind === 'hook') {
    baseG = 26.5 + power * 7.8;
    baseSpeed = 23.5 * power;
  } else if (kind === 'signature' || isSuper) {
    baseG = 46.0 + power * 11.5;
    baseSpeed = 31.0 * power;
  }

  if (isCounter) {
    baseG *= 1.32;
    baseSpeed *= 1.15;
  }

  const gForce = Math.round(baseG * 10) / 10;
  const speedMs = Math.round(baseSpeed * 10) / 10;

  let rating: 'S' | 'A' | 'B' | 'C' = 'C';
  if (gForce >= 42.0) rating = 'S';
  else if (gForce >= 28.0) rating = 'A';
  else if (gForce >= 18.0) rating = 'B';

  return { gForce, speedMs, rating };
}

/** Provide tactical intelligence breakdown for the current opponent. */
export function getOpponentTacticalIntel(
  opponentId: OpponentId | null,
  fallbackVisual: CharacterId = 'bear',
): TacticalOpponentIntel {
  if (opponentId) {
    const opp = getOpponent(opponentId);
    switch (opp.id) {
      case 'pillow':
        return {
          opponentId: opp.id,
          name: opp.name,
          tagline: opp.tagline,
          styleBadge: '防守反擊流・偏下段',
          styleCategory: 'counter',
          styleDescription: '偏好下段格擋，出招謹慎，耐力回充迅速。',
          signatureName: opp.signature.name,
          signatureBlurb: opp.signature.blurb,
          signatureTelegraph: '下沉收拳，長蓄力預備',
          signatureCounterMeasure: '可下段抱架防守，或提前抓時機撥招',
          radarStats: { aggression: 58, defense: 85, speed: 65, power: 55 },
          tacticalAdvices: [
            '對手喜愛護下段，可多以上段刺拳試探擊破防線。',
            '對手出拳頻率較低，抓準空檔切入連續勾拳。',
          ],
        };
      case 'rush':
        return {
          opponentId: opp.id,
          name: opp.name,
          tagline: opp.tagline,
          styleBadge: '狂暴猛攻型・上段重砲',
          styleCategory: 'rushdown',
          styleDescription: '步步進逼，高頻率施展上段重勾拳，極具威脅。',
          signatureName: opp.signature.name,
          signatureBlurb: opp.signature.blurb,
          signatureTelegraph: '前傾昂首，狂暴氣場蓄力',
          signatureCounterMeasure: '無法格擋！唯一解法為按 W 閃避',
          radarStats: { aggression: 90, defense: 45, speed: 70, power: 92 },
          tacticalAdvices: [
            '招牌衝撞不可格擋，看見預備必須第一時間閃避。',
            '猛攻耗體極快，善用下段打腹加速掏空其耐力。',
          ],
        };
      case 'needle':
        return {
          opponentId: opp.id,
          name: opp.name,
          tagline: opp.tagline,
          styleBadge: '精準刺拳流・高頻壓制',
          styleCategory: 'outboxer',
          styleDescription: '出拳極快，專攻上段破綻，反擊機率極高。',
          signatureName: opp.signature.name,
          signatureBlurb: opp.signature.blurb,
          signatureTelegraph: '極短預備，雙手微震刺出',
          signatureCounterMeasure: '起手極快，建議提早以 I 鍵撥招反制',
          radarStats: { aggression: 78, defense: 75, speed: 95, power: 65 },
          tacticalAdvices: [
            '對手極度偏好上段刺拳，可提前做好上段格擋或撥招準備。',
            '下段沉身出拳能有效避開其刺拳鋒芒並削弱其耐力。',
          ],
        };
      case 'feint':
        return {
          opponentId: opp.id,
          name: opp.name,
          tagline: opp.tagline,
          styleBadge: '虛晃誘敵流・節奏干擾',
          styleCategory: 'trickster',
          styleDescription: '高機率假動作取消出拳，誘使防守後予以反擊。',
          signatureName: opp.signature.name,
          signatureBlurb: opp.signature.blurb,
          signatureTelegraph: '原地旋轉蓄力，釋放誘敵重拳',
          signatureCounterMeasure: '長預備無法格擋，冷靜觀察並以 W 閃避',
          radarStats: { aggression: 60, defense: 80, speed: 92, power: 60 },
          tacticalAdvices: [
            '切勿看見起手就盲目按鍵，需確認是否為虛晃假動作。',
            '保持冷靜防守，在其真正出拳落空後立即懲罰。',
          ],
        };
      case 'ironbelly':
        return {
          opponentId: opp.id,
          name: opp.name,
          tagline: opp.tagline,
          styleBadge: '重裝打腹流・耐力收割',
          styleCategory: 'body_puncher',
          styleDescription: '專注進攻玩家下段腹部，極度削弱我方耐力回充。',
          signatureName: opp.signature.name,
          signatureBlurb: opp.signature.blurb,
          signatureTelegraph: '巨尾下盤蓄力，重重撕裂下腹',
          signatureCounterMeasure: '按住 ↓+S 下段嚴密封阻，或抓時機下段撥招',
          radarStats: { aggression: 68, defense: 78, speed: 60, power: 85 },
          tacticalAdvices: [
            '必須時常保持下段格擋戒備，防止耐力被掏空進入疲勞。',
            '對手移動速度較慢，可利用距離打出命中即撤戰術。',
          ],
        };
      case 'champ':
      default:
        return {
          opponentId: opp.id,
          name: opp.name,
          tagline: opp.tagline,
          styleBadge: '全能霸主・極限預讀',
          styleCategory: 'all_rounder',
          styleDescription: '完美適應玩家出拳習慣，攻防一體無懈可擊。',
          signatureName: opp.signature.name,
          signatureBlurb: opp.signature.blurb,
          signatureTelegraph: '18幀超長蓄力，冠軍旋轉重拳',
          signatureCounterMeasure: '無法格擋！抓準最後時機精準閃避',
          radarStats: { aggression: 88, defense: 92, speed: 88, power: 90 },
          tacticalAdvices: [
            '不可重複相同出拳路線，冠軍會迅速記錄並精準撥招。',
            '上下段靈活切換，誘使其防守落空再給予重創。',
          ],
        };
    }
  }

  // Fallback for free mode
  const visualMap: Record<
    CharacterId,
    { badge: string; cat: TacticalOpponentIntel['styleCategory']; desc: string; stats: TacticalRadarStats }
  > = {
    bot: {
      badge: '均衡科技流・攻守兼備',
      cat: 'all_rounder',
      desc: '數值全面均衡，具備靈活的上段打擊與防護。',
      stats: { aggression: 70, defense: 70, speed: 70, power: 70 },
    },
    bear: {
      badge: '重裝巨力流・以力破巧',
      cat: 'rushdown',
      desc: '血量厚實拳力強大，專精上段爆發式勾拳。',
      stats: { aggression: 85, defense: 60, speed: 55, power: 90 },
    },
    bunny: {
      badge: '迅捷游擊流・靈動連擊',
      cat: 'outboxer',
      desc: '身手敏捷迴避率高，擅長快速進退與連續刺拳。',
      stats: { aggression: 65, defense: 75, speed: 92, power: 60 },
    },
    dino: {
      badge: '鐵甲破防流・霸道壓迫',
      cat: 'body_puncher',
      desc: '善於下段重擊與近身壓制，破壞力驚人。',
      stats: { aggression: 80, defense: 75, speed: 65, power: 85 },
    },
  };

  const info = visualMap[fallbackVisual] ?? visualMap.bear;
  return {
    opponentId: 'free-cpu',
    name: fallbackVisual === 'bot' ? '藍拳機器人' : fallbackVisual === 'bunny' ? '閃電兔' : fallbackVisual === 'dino' ? '鐵拳恐龍' : '紅絨熊仔',
    tagline: '自由對戰擂台勁敵',
    styleBadge: info.badge,
    styleCategory: info.cat,
    styleDescription: info.desc,
    signatureName: '絕殺重拳',
    signatureBlurb: '長預備・無法格擋・可閃避',
    signatureTelegraph: '蓄力後擺，釋放強大衝擊',
    signatureCounterMeasure: '看清紅光閃爍，及時使用 W 鍵俯身閃避',
    radarStats: info.stats,
    tacticalAdvices: [
      '留意對手預備動作，抓準出拳落空時的反擊機會。',
      '善用 ↓ 鍵下段攻擊削弱對手耐力回復。',
    ],
  };
}

export interface CoachContext {
  playerHealth: number;
  playerMaxHealth: number;
  playerStamina: number;
  playerStun: number;
  playerSuper: number;
  playerBodyFatigue: number;
  cpuHealth: number;
  cpuMaxHealth: number;
  cpuStamina: number;
  cpuStun: number;
  cpuSuper: number;
  cpuIsWindup: boolean;
  cpuIsSignature: boolean;
  cpuHeight: Height;
  cpuStaggered: boolean;
  opponentIntel: TacticalOpponentIntel;
}

/** Dynamic Mastermind Ring Coach delivering actionable advice. */
export function getLiveMasterCoachHint(ctx: CoachContext): MasterCoachHint {
  // Danger 1: CPU Signature Windup
  if (ctx.cpuIsSignature) {
    return {
      badge: '極度危險',
      tone: 'danger',
      text: `⚠️ 對手正在施展【${ctx.opponentIntel.signatureName}】！無法格擋，立即按 Ｗ 閃避！`,
    };
  }

  // Opportunity 1: CPU Staggered by Parry
  if (ctx.cpuStaggered) {
    return {
      badge: '絕殺破綻',
      tone: 'opportunity',
      text: '💥 對手陷入撥招大硬直！立刻打出勾拳 (K) 或釋放招牌拳 (L)！',
    };
  }

  // Danger 2: Player Stun Alert
  if (ctx.playerStun >= 70) {
    return {
      badge: '眩暈危急',
      tone: 'danger',
      text: '🚨 我方暈眩條瀕臨極限！後撤拉開距離，按住 Ｓ 嚴密封擋！',
    };
  }

  // Opportunity 2: CPU Counter Window Active (Normal windup)
  if (ctx.cpuIsWindup) {
    return {
      badge: '反擊時機',
      tone: 'opportunity',
      text: '⚡ 對手起手蓄力中！反擊窗口已開啟，以刺拳 (J) 搶先截擊中斷！',
    };
  }

  // Opportunity 3: CPU Head Stun KO Opportunity
  if (ctx.cpuStun >= 68) {
    return {
      badge: 'ＫＯ良機',
      tone: 'opportunity',
      text: '🎯 對手頭部受創嚴重！連續上段勾拳 (K) 爭取頭擊ＫＯ！',
    };
  }

  // Opportunity 4: Player Super Meter Full
  if (ctx.playerSuper >= 100) {
    return {
      badge: '能量全滿',
      tone: 'opportunity',
      text: '🔥 必殺能量蓄滿！等待對手出拳後搖空檔，按 Ｌ 釋放招牌拳！',
    };
  }

  // Opportunity 5: CPU Stamina Depleted
  if (ctx.cpuStamina <= 20) {
    return {
      badge: '耐力枯竭',
      tone: 'opportunity',
      text: '🩸 對手耐力見底防禦吃緊！切入下段 (↓+J/K) 徹底瓦解呼吸！',
    };
  }

  // Warning: Player Low Stamina
  if (ctx.playerStamina <= 25) {
    return {
      badge: '體力告急',
      tone: 'warning',
      text: '⚠️ 自身耐力耗竭揮拳疲軟！暫停出拳，專注格擋與走位回充！',
    };
  }

  // Warning: Player High Body Fatigue
  if (ctx.playerBodyFatigue >= 0.35) {
    return {
      badge: '腹部受創',
      tone: 'warning',
      text: '🛡️ 腹部累積疲勞影響回氣！加強下段 (↓+S) 防守保護下盤！',
    };
  }

  // Default tactical advice from Opponent Intel
  const defaultAdvice = ctx.opponentIntel.tacticalAdvices[0]
    ?? '觀察對手起手節奏，上下段靈活變換尋求破綻！';

  return {
    badge: '戰術指引',
    tone: 'info',
    text: `🥊 ${defaultAdvice}`,
  };
}
