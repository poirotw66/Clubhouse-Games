import assert from 'node:assert/strict';
import {
  TOUR_AI,
  createTournament,
  evaluateTourLeg,
  advanceTourLeg,
  tournamentCup,
  tournamentCupIcon,
  createDuel,
  recordDuelTurn,
  evaluateDuel,
  b64u,
  makeBattleCodeFromRec,
  parseBattleCode,
  rivalPoseFrom,
  formatLeaderboardPayload,
} from './paddock.js';

// 1. Tournament 3-leg mechanics
{
  assert.deepEqual(TOUR_AI, ['pony', 'race', 'legend']);
  const tour = createTournament();
  assert.equal(tour.on, true);
  assert.equal(tour.leg, 1);
  assert.equal(tour.pts, 0);
  assert.equal(tour.marks, '');
  assert.equal(tour.history.length, 0);

  // Leg 1: Player beats Pony
  const win1 = evaluateTourLeg(tour, 42.0, false, 68.0);
  assert.equal(win1, true);
  assert.equal(tour.pts, 3);
  assert.equal(tour.marks, '勝');
  assert.equal(tour.history.length, 1);
  assert.equal(tour.history[0].opponent, 'pony');
  assert.ok(advanceTourLeg(tour));
  assert.equal(tour.leg, 2);

  // Leg 2: Player loses to Racehorse
  const win2 = evaluateTourLeg(tour, 35.2, false, 31.8);
  assert.equal(win2, false);
  assert.equal(tour.pts, 3);
  assert.equal(tour.marks, '勝負');
  assert.ok(advanceTourLeg(tour));
  assert.equal(tour.leg, 3);

  // Leg 3: Player beats Legend
  const win3 = evaluateTourLeg(tour, 22.1, false, 23.0);
  assert.equal(win3, true);
  assert.equal(tour.pts, 6);
  assert.equal(tour.marks, '勝負勝');
  assert.equal(advanceTourLeg(tour), false, 'Cannot advance past leg 3');
  assert.equal(tour.leg, 3);

  // Cup tiers
  assert.equal(tournamentCup(9), 'champ9');
  assert.equal(tournamentCupIcon(9), '🏆');
  assert.equal(tournamentCup(6), 'champ6');
  assert.equal(tournamentCupIcon(6), '🥈');
  assert.equal(tournamentCup(3), 'champ3');
  assert.equal(tournamentCupIcon(3), '🥉');
  assert.equal(tournamentCup(0), 'champ0');
  assert.equal(tournamentCupIcon(0), '🐎');

  // DNF is always a loss
  const tourDnf = createTournament();
  const dnfWin = evaluateTourLeg(tourDnf, 90.0, true, null);
  assert.equal(dnfWin, false);
  assert.equal(tourDnf.pts, 0);
  assert.equal(tourDnf.marks, '負');
}

// 2. Local 2-player duel rules
{
  const duel = createDuel();
  assert.equal(duel.on, true);
  assert.equal(duel.turn, 1);
  assert.equal(duel.t1, 0);
  assert.equal(duel.t2, 0);

  // Turn 1
  recordDuelTurn(duel, 26.5, false);
  assert.equal(duel.t1, 26.5);
  duel.turn = 2;

  // Turn 2: 2P faster
  recordDuelTurn(duel, 24.8, false);
  assert.equal(duel.t2, 24.8);
  const outcome1 = evaluateDuel(duel);
  assert.equal(outcome1.winner, 2);
  assert.equal(outcome1.key, 'duel_p2win');
  assert.equal(outcome1.icon, '2️⃣');

  // 1P faster scenario
  const duel2 = createDuel();
  recordDuelTurn(duel2, 21.0, false);
  duel2.turn = 2;
  recordDuelTurn(duel2, 23.4, false);
  const outcome2 = evaluateDuel(duel2);
  assert.equal(outcome2.winner, 1);
  assert.equal(outcome2.key, 'duel_p1win');
  assert.equal(outcome2.icon, '1️⃣');

  // Exact draw scenario
  const duelDraw = createDuel();
  recordDuelTurn(duelDraw, 30.0, false);
  duelDraw.turn = 2;
  recordDuelTurn(duelDraw, 30.0, false);
  const outcomeDraw = evaluateDuel(duelDraw);
  assert.equal(outcomeDraw.winner, 0);
  assert.equal(outcomeDraw.key, 'duel_draw');
  assert.equal(outcomeDraw.icon, '🤝');

  // DNF scenarios
  const duelDnf1 = createDuel();
  recordDuelTurn(duelDnf1, 90.0, true);
  duelDnf1.turn = 2;
  recordDuelTurn(duelDnf1, 45.0, false);
  assert.equal(evaluateDuel(duelDnf1).winner, 2);

  const duelDnfBoth = createDuel();
  recordDuelTurn(duelDnfBoth, 90.0, true);
  duelDnfBoth.turn = 2;
  recordDuelTurn(duelDnfBoth, 90.0, true);
  assert.equal(evaluateDuel(duelDnfBoth).winner, 0);
}

// 3. Ghost recording & battle code serialization / deserialization
{
  // URL-safe base64 helper
  const rawBytes = new Uint8Array([0, 255, 128, 64, 32]);
  const enc = b64u.enc(rawBytes);
  assert.ok(!enc.includes('+') && !enc.includes('/') && !enc.includes('='));
  assert.deepEqual(b64u.dec(enc), rawBytes);

  // Synthesize 301 frames (10 seconds at 30 Hz) traveling 0 to 50 meters
  const rec = [];
  for (let i = 0; i <= 300; i++) {
    const x = (i / 300) * 50.0;
    rec.push([x, 1.05]);
  }

  const code = await makeBattleCodeFromRec(rec, 10.0, 0, 40, 8.5);
  assert.ok(/^CC[01]\.[A-Za-z0-9_-]+$/.test(code), `Code must match CC header format, got: ${code}`);

  const parsed = await parseBattleCode(code);
  assert.equal(parsed.v, 1);
  assert.equal(parsed.t, 100); // 10.0s * 10
  assert.equal(parsed.f, 0);
  assert.equal(parsed.s, 40);
  assert.equal(parsed.sp, Math.round(8.5 * 36));
  assert.equal(parsed.x.length, 101); // 10 Hz sampled from 301 frames
  assert.equal(parsed.x[0], 0);
  assert.equal(parsed.x[parsed.x.length - 1], 500); // 50.0m * 10

  // Rival 30 Hz pose stream reconstruction
  const poses = rivalPoseFrom(parsed, 1.05);
  assert.equal(poses.length, 101 * 3);
  for (let i = 0; i < poses.length; i++) {
    const frame = poses[i];
    assert.equal(frame.length, 14);
    assert.ok(frame[0] >= 0 && frame[0] <= 50.1, `Frame ${i} x out of range: ${frame[0]}`);
    assert.ok(Math.abs(frame[1] - 1.05) <= 0.04, `Frame ${i} y out of range: ${frame[1]}`);
    // Check 4 leg lift values in [0, 1]
    for (let l = 10; l <= 13; l++) {
      assert.ok(frame[l] >= 0 && frame[l] <= 1, `Leg lift out of range: ${frame[l]}`);
    }
  }

  // Corruption rejection
  await assert.rejects(() => parseBattleCode('INVALID.CODE'), /Invalid battle code header format/);
  await assert.rejects(() => parseBattleCode('CC1.invalid-payload!!!'), /Invalid battle code header format/);
  await assert.rejects(() => parseBattleCode('CC1.YWJj'), /no-inflate|Decompression/);
  await assert.rejects(() => parseBattleCode('CC0.' + b64u.enc(new TextEncoder().encode(JSON.stringify({ v: 2 })))), /Corrupted or truncated/);
  await assert.rejects(() => parseBattleCode('CC0.' + b64u.enc(new TextEncoder().encode(JSON.stringify({ v: 1, x: [1, 2] })))), /Corrupted or truncated/);
}

// 4. Supabase leaderboard payload formatting
{
  const normalPayload = formatLeaderboardPayload({
    name: '  馬王Champion  ',
    finishTime: 21.84,
    falls: 0,
    steps: 76,
    topSpeed: 8.9,
    code: 'CC1.test_valid_code',
    mode: 'normal',
  });
  assert.deepEqual(normalPayload, {
    name: '馬王Champion',
    time_ms: 21840,
    falls: 0,
    steps: 76,
    speed: 320,
    code: 'CC1.test_valid_code',
    mode: 'normal',
    day: null,
  });

  const dailyPayload = formatLeaderboardPayload({
    name: 'DailyRider',
    finishTime: 33.12,
    falls: 2,
    steps: 92,
    topSpeed: 6.5,
    code: 'CC1.test_daily_code',
    mode: 'daily',
    day: '2026-11-19',
  });
  assert.deepEqual(dailyPayload, {
    name: 'DailyRider',
    time_ms: 33120,
    falls: 2,
    steps: 92,
    speed: 234,
    code: 'CC1.test_daily_code',
    mode: 'daily',
    day: '2026-11-19',
  });

  // Name length truncation to 10 chars
  const longNamePayload = formatLeaderboardPayload({
    name: 'SuperLongEquestrianName',
    finishTime: 25.0,
    falls: 0,
    code: 'CC0.valid_code',
  });
  assert.equal(longNamePayload.name, 'SuperLongE');

  // Input validation guards
  assert.throws(() => formatLeaderboardPayload({ name: '', finishTime: 20, falls: 0, code: 'CC1.x' }), /Player name is required/);
  assert.throws(() => formatLeaderboardPayload({ name: 'A', finishTime: 0, falls: 0, code: 'CC1.x' }), /Valid finishTime is required/);
  assert.throws(() => formatLeaderboardPayload({ name: 'A', finishTime: -5, falls: 0, code: 'CC1.x' }), /Valid finishTime is required/);
  assert.throws(() => formatLeaderboardPayload({ name: 'A', finishTime: 20, falls: -1, code: 'CC1.x' }), /Valid falls count is required/);
  assert.throws(() => formatLeaderboardPayload({ name: 'A', finishTime: 20, falls: 0, code: 'BAD_CODE' }), /Valid CC battle code is required/);
  assert.throws(() => formatLeaderboardPayload({ name: 'A', finishTime: 20, falls: 0, code: 'CC1.x', mode: 'ranked' }), /Mode must be normal or daily/);
  assert.throws(() => formatLeaderboardPayload({ name: 'A', finishTime: 20, falls: 0, code: 'CC1.x', mode: 'daily', day: 'invalid-date' }), /Valid day format YYYY-MM-DD/);
  assert.throws(() => formatLeaderboardPayload({ name: 'A', finishTime: 20, falls: 0, code: 'CC1.x', mode: 'daily', day: null }), /Valid day format YYYY-MM-DD/);
}

console.log('check-paddock: ok (tournament 3-leg mechanics, duel rules, ghost/battle-code serialization, Supabase leaderboard formatting)');
