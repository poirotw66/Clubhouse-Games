/**
 * StatCast Telemetry & Strike Zone Tracking for Toy Baseball.
 * Converts simulation physics into real-world broadcast baseball metrics.
 */

import type { PitchLoc, PitchType } from './pitching.ts';
import { PITCH_DEFS } from './pitching.ts';

export interface PitchTelemetry {
  pitchType: PitchType;
  pitchLoc: PitchLoc;
  speedKmh: number;
  spinRpm: number;
  breakCmX: number;
  breakCmZ: number;
}

export type BarrelGrade = 'barrel' | 'solid' | 'flare' | 'weak';

export interface HitTelemetry {
  exitVeloKmh: number;
  launchAngleDeg: number;
  projectedDistM: number;
  barrelGrade: BarrelGrade;
  barrelLabel: string;
}

export interface StrikeZonePitch {
  id: number;
  pitchType: PitchType;
  loc: PitchLoc;
  isStrike: boolean;
  result: string;
  xPercent: number; // 0 (left) to 100 (right)
  yPercent: number; // 0 (high) to 100 (low)
}

/**
 * Maps simulation pitch properties to realistic StatCast pitch telemetry (km/h, RPM, cm break).
 */
export function calculatePitchTelemetry(
  pitchType: PitchType,
  pitchLoc: PitchLoc,
  seedRand: number = 0.5,
): PitchTelemetry {
  const def = PITCH_DEFS[pitchType];
  const jitter = (seedRand - 0.5) * 4;

  let baseKmh = 148;
  let baseRpm = 2300;

  switch (pitchType) {
    case 'fastball':
      baseKmh = 152 + jitter;
      baseRpm = 2420 + jitter * 30;
      break;
    case 'slider':
      baseKmh = 138 + jitter;
      baseRpm = 2550 + jitter * 25;
      break;
    case 'curve':
      baseKmh = 122 + jitter;
      baseRpm = 2680 + jitter * 35;
      break;
    case 'changeup':
      baseKmh = 129 + jitter;
      baseRpm = 1820 + jitter * 20;
      break;
    case 'sinker':
      baseKmh = 147 + jitter;
      baseRpm = 2150 + jitter * 25;
      break;
    case 'forkball':
      baseKmh = 133 + jitter;
      baseRpm = 1250 + jitter * 20;
      break;
  }

  const breakCmX = Math.round(def.breakX * 0.45);
  const breakCmZ = Math.round(def.breakZ * 0.4);

  return {
    pitchType,
    pitchLoc,
    speedKmh: Math.round(baseKmh * 10) / 10,
    spinRpm: Math.round(baseRpm),
    breakCmX,
    breakCmZ,
  };
}

/**
 * Converts batted-ball launch velocity and contact quality into StatCast metrics.
 */
export function calculateHitTelemetry(
  contactQuality: number,
  vel: { x: number; y: number; z: number },
  isBunt: boolean = false,
): HitTelemetry {
  if (isBunt) {
    return {
      exitVeloKmh: Math.round(62 + contactQuality * 24),
      launchAngleDeg: -8,
      projectedDistM: Math.round(18 + contactQuality * 16),
      barrelGrade: 'weak',
      barrelLabel: '觸擊滾地',
    };
  }

  const totalSpeed = Math.sqrt(vel.x ** 2 + vel.y ** 2);
  // Scale speed into 88 - 176 km/h exit velocity range
  const exitVeloKmh = Math.round(85 + contactQuality * 88);

  // Compute launch angle in degrees from horizontal vs vertical velocity
  const rawAngleRad = Math.atan2(vel.z, totalSpeed);
  let launchAngleDeg = Math.round((rawAngleRad * 180) / Math.PI);
  // Clamp launch angle into realistic baseball range (-15° to 52°)
  launchAngleDeg = Math.max(-15, Math.min(52, launchAngleDeg));

  // Estimate carry distance in meters
  const distM = Math.round(35 + contactQuality * 85 + (launchAngleDeg > 18 && launchAngleDeg < 38 ? 12 : 0));

  let barrelGrade: BarrelGrade = 'weak';
  let barrelLabel = '軟弱擊球 (Weak)';

  if (exitVeloKmh >= 150 && launchAngleDeg >= 22 && launchAngleDeg <= 36) {
    barrelGrade = 'barrel';
    barrelLabel = '甜蜜擊球 (Barrel)';
  } else if (exitVeloKmh >= 140 && launchAngleDeg >= 10 && launchAngleDeg <= 38) {
    barrelGrade = 'solid';
    barrelLabel = '紮實強擊 (Hard Hit)';
  } else if (contactQuality >= 0.6) {
    barrelGrade = 'flare';
    barrelLabel = '巧妙落點 (Flare)';
  }

  return {
    exitVeloKmh,
    launchAngleDeg,
    projectedDistM: distM,
    barrelGrade,
    barrelLabel,
  };
}

/**
 * Converts pitch location and simulated strike zone roll into 0-100% strike zone coordinates.
 */
export function getStrikeZoneCoords(
  loc: PitchLoc,
  isStrike: boolean,
  randOffset: number = 0.5,
): { xPercent: number; yPercent: number } {
  let baseX = 50;
  if (loc === 'left') baseX = isStrike ? 30 : 12;
  else if (loc === 'right') baseX = isStrike ? 70 : 88;
  else baseX = 50;

  const jitterX = (randOffset - 0.5) * 14;
  const xPercent = Math.max(8, Math.min(92, baseX + jitterX));

  // Strike zone height 30% to 70%
  let baseY = isStrike ? 50 : (randOffset > 0.5 ? 18 : 82);
  const jitterY = ((randOffset * 7) % 1 - 0.5) * 16;
  const yPercent = Math.max(10, Math.min(90, baseY + jitterY));

  return {
    xPercent: Math.round(xPercent),
    yPercent: Math.round(yPercent),
  };
}
