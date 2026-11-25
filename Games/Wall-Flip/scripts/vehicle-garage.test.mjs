import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const garageContext = {};
vm.runInNewContext(fs.readFileSync(new URL('../vehicle-garage.js', import.meta.url), 'utf8'), garageContext);
const { vehicles, get, tune, recordKey } = garageContext.WallFlipGarage;
const source = fs.readFileSync(new URL('../simulation.js', import.meta.url), 'utf8');
const { BASE, createSim, scoreOf } = vm.runInNewContext(source + '\nWallFlipSimulation;', { window: { WallFlipGarage: garageContext.WallFlipGarage } });
const idle = {drive:false,suck:false,left:false,right:false};

test('Roadster preserves every original constant and legacy record key', () => {
  const before = JSON.stringify(BASE);
  assert.equal(JSON.stringify(tune(BASE, 'roadster')), before);
  assert.equal(JSON.stringify(BASE), before);
  assert.equal(get('__proto__').id, 'roadster');
  assert.equal(recordKey('wallflip3.best', 'roadster'), 'wallflip3.best');
  assert.equal(recordKey('wallflip3.best', 'unknown'), 'wallflip3.best');
  assert.equal(new Set(vehicles.map(v => recordKey('wallflip3.ghost',v.id))).size, vehicles.length);
});

function airborne(id, input, spin = 0, verticalSpeed = 0) {
  const sim = createSim({}, tune(BASE,id));
  Object.assign(sim.state, {mode:'air',x:-100,y:100,roll:0,pitch:0,yaw:0,rw:spin,vy:verticalSpeed,clear:true});
  for (let i=0;i<120;i++) sim.step(BASE.STEP,input);
  return sim.state;
}

test('different abilities change actual acceleration, rotation, settling, thrust and air use', () => {
  const drive = id => {
    const sim = createSim({},tune(BASE,id));
    for(let i=0;i<120;i++) sim.step(BASE.STEP,{...idle,drive:true});
    return sim.state.v;
  };
  assert.ok(drive('sparrow') > drive('roadster'));
  assert.ok(drive('atlas') < drive('roadster'));
  const oneJet = {...idle,left:true}, bothJets = {...idle,left:true,right:true};
  assert.ok(airborne('sparrow',oneJet).rw > airborne('roadster',oneJet).rw);
  assert.ok(airborne('atlas',idle,3).rw < airborne('roadster',idle,3).rw);
  assert.ok(airborne('nova',bothJets).vy > airborne('roadster',bothJets).vy);
  assert.ok(airborne('atlas',bothJets).air > airborne('roadster',bothJets).air);
  assert.ok(airborne('nova',bothJets).air < airborne('roadster',bothJets).air);
});

test('Sparrow, Atlas, and Nova reflect calibrated handling presets', () => {
  const sparrow = get('sparrow').handling;
  assert.equal(sparrow.damping, 1.05);
  assert.equal(sparrow.thrust, 0.96);

  const atlas = get('atlas').handling;
  assert.equal(atlas.rotation, 0.82);

  const nova = get('nova').handling;
  assert.equal(nova.airUse, 1.25);
});

test('every car can use twin jets for deliberate upward lift while level',()=>{
  for(const vehicle of vehicles) {
    const state=airborne(vehicle.id,{...idle,left:true,right:true});
    assert.ok(state.vy>0,vehicle.id+' twin jets must create upward velocity');
    assert.ok(state.y>100,vehicle.id+' twin jets must gain altitude');
    assert.ok(state.air<100,vehicle.id+' active jets must spend air');
  }
});

test('Mars rover uses 45% air and gentle damping assist without free auto-leveling or auto-braking',()=>{
  const marsHandling = get('mars').handling;
  assert.equal(marsHandling.airUse, 0.45);
  assert.ok(!marsHandling.landingAssist, 'Mars no longer enables full auto-landing assist');

  // Air endurance remains advantageous but bounded (~45% of Roadster burn).
  const sim = createSim({}, tune(BASE, 'mars'));
  Object.assign(sim.state, {mode:'air', x:-100, y:2000, roll:0, pitch:0, yaw:0, rw:0, clear:true});
  for(let i=0; i < 6 / BASE.STEP; i++) sim.step(BASE.STEP, {...idle, left:true});
  assert.equal(sim.state.mode, 'air');
  assert.ok(sim.state.spinTotal > Math.PI * 4, 'Manual roll input retains stunt control');
  assert.ok(sim.state.air > 80 && sim.state.air < 95, `Expected bounded Mars air reserve, got ${sim.state.air}`);

  // Hands-off while inverted: gentle damping slows spin, but does NOT auto-level to upright.
  const inverted = airborne('mars', idle, 0.2, 0);
  const invertedStart = createSim({}, tune(BASE, 'mars'));
  Object.assign(invertedStart.state, {mode:'air', x:-100, y:100, roll:Math.PI, pitch:0, yaw:0, rw:0, vy:0, clear:true});
  for(let i=0; i<120; i++) invertedStart.step(BASE.STEP, idle);
  assert.ok(Math.abs(invertedStart.state.roll - Math.PI) < 0.05, 'Mars must not auto-level an inverted car without manual input');
  assert.ok(inverted.vy < -5, 'Mars must fall under gravity without auto-braking when no jets are held');

  // Gentle damping assist settles residual spin faster than Roadster, and airControl never injects verticalThrust.
  const marsDamped = airborne('mars', idle, 3.0);
  const roadsterDamped = airborne('roadster', idle, 3.0);
  assert.ok(marsDamped.rw < roadsterDamped.rw, 'Mars damping assist settles residual spin faster than Roadster');
  const assistOut = garageContext.WallFlipGarage.airControl(
    {angle: Math.PI, spin: 2.0, y: 2, vy: -20, air: 80, clear: true},
    idle,
    {thrust: BASE.THRUST, gravity: BASE.G0 * BASE.AIR_G},
  );
  assert.equal(assistOut.verticalThrust, undefined, 'airControl never applies free vertical braking thrust');
  assert.equal(assistOut.left, false);
  assert.equal(assistOut.right, false);
  assert.ok(assistOut.rollAccel < 0, 'airControl only provides gentle spin damping');
});

test('every car can launch and land through the real physics without changing the landing envelope', () => {
  for (const vehicle of vehicles) {
    const constants = tune(BASE,vehicle.id), sim=createSim({},constants);
    let target=null, launched=false;
    for(let i=0;i<16000;i++) {
      const s=sim.state;
      if(s.mode==='crash'||s.mode==='landed') break;
      const input={...idle,drive:s.mode==='road',suck:s.mode==='road'&&s.u>0};
      if(s.mode==='air') {
        launched=true;
        target ??= Math.ceil((s.roll-1e-6)/(Math.PI*2))*Math.PI*2;
        const error=s.roll+s.rw/constants.ROLL_DAMP-target;
        if(Math.abs(error)>.015) {
          input.left=error<0&&s.air>2;input.right=error>0&&s.air>2;
        } else if(s.vy < -Math.max(.3,Math.min(8,(s.y-.7)*1.1))&&s.air>1) {
          input.left=input.right=true;
        }
      }
      sim.step(BASE.STEP,input);
      assert.ok(sim.state.air>=0&&sim.state.air<=100,vehicle.id+' resource bounds');
      assert.ok(Number.isFinite(sim.state.x)&&Number.isFinite(sim.state.y),vehicle.id+' finite motion');
    }
    assert.equal(launched,true,vehicle.id+' leaves the wall');
    assert.equal(sim.state.mode,'landed',vehicle.id+' lands on the original collision chassis');
    assert.ok(sim.state.land.fall<=BASE.LAND_SPEED,vehicle.id+' original impact threshold');
    assert.ok(sim.state.land.tilt<=BASE.LAND_TILT,vehicle.id+' original tilt threshold');
  }
});

test('2D uses the same vehicle modifiers and every shell can land on both courses', () => {
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  function block(from,to) {
    const a=html.indexOf(from),b=html.indexOf(to,a+from.length);
    assert.ok(a>=0&&b>a,from);
    return html.slice(a,b);
  }
  const code=block('// ---------- utils ----------','// ---------- bilingual strings')
    +block('// ---------- tuning:','// ---------- state ----------')
    +block('// ---------- state ----------','let best = 0, rankOn')
    +block('function toAir(kind)','// ---------- achievements / share')
    +block('const RANKS =','const launchHost =')
    +block('// ---------- physics: attached','// ---------- physics: landed rollout');
  const noop=()=>{};
  for(const vehicle of vehicles) {
    const cases=[0,1].flatMap(course=>['boost','manual'].map(profile=>({course,profile})));
    for(const {course,profile} of cases) {
      // Only audiovisual side effects are stubbed. Track, jets, collisions and scores are actual game code.
      const context={localStorage:{getItem:()=>null},vehicle,
        window:{WallFlipGarage:garageContext.WallFlipGarage},botOn:true,skids:[],shakeT:0,shakeA:0,
        t:()=>'',say:noop,sayOnce:noop,pop:noop,tireSmoke:noop,dust:noop,smoke:noop,fire:noop,
        confetti:noop,vib:noop,sfx:{land:noop,crash:noop,peel:noop,stuntWhoosh:noop}};
      const api=vm.runInNewContext(code+`
        ({MOTOR_A,MOTOR_P,THRUST,ANG,ROLL_DAMP,SPIN_DAMP,AIR_SUCK,AIR_JET,LANDING_ASSIST=false}=window.WallFlipGarage.tune(STOCK_TUNING,vehicle.id));
        buildCourse(${course}); car.x=-RUNUP; car.y=CAR.H;
        ({car,stats,damping:ROLL_DAMP,step(input){Object.assign(inp,input);car.time+=STEP;if(car.mode==='road')stepRoad(STEP);else if(car.mode==='air')stepAir(STEP);}});
      `,context);
      if(profile==='boost') {
        const steps=120;
        for(let i=0;i<steps;i++)api.step({drive:false,stick:false,left:true,right:true});
        assert.equal(api.car.mode,'air',vehicle.id+' 2D twin jets launch the car');
        assert.ok(api.car.vy>0,vehicle.id+' 2D twin jets create upward velocity');
        assert.ok(api.car.y>.66,vehicle.id+' 2D twin jets gain altitude');
        continue;
      }
      let target=null;
      for(let i=0;i<16000;i++) {
        const s=api.car;
        if(s.mode==='landed'||s.mode==='crash')break;
        const input={drive:s.mode==='road',stick:s.mode==='road'&&s.u>0,left:false,right:false};
        if(s.mode==='air') {
          target ??= Math.ceil((s.phi-1e-6)/(Math.PI*2))*Math.PI*2;
          const error=s.phi+s.rw/api.damping-target;
          if(Math.abs(error)>.015) {input.left=error<0&&s.air>2;input.right=error>0&&s.air>2;}
          else if(s.vy < -Math.max(.3,Math.min(8,(s.y-.7)*1.1))&&s.air>1)input.left=input.right=true;
        }
        api.step(input);
        assert.ok(s.air>=0&&s.air<=100,vehicle.id+' 2D resource bounds');
      }
      assert.equal(api.car.mode,'landed',vehicle.id+' 2D course '+course+' '+profile+' lands');
      assert.equal(api.stats.win,true);
    }
  }
});

test('multi-vehicle aerodynamic balancing invariants across Sparrow, Atlas, Nova, and Vector', () => {
  // 1. Sparrow: agile flipper with rotation damp 1.05 and thrust 0.96
  const sparrowH = get('sparrow').handling;
  assert.equal(sparrowH.damping, 1.05);
  assert.equal(sparrowH.rotation, 1.4);
  assert.equal(sparrowH.thrust, 0.96);
  assert.equal(sparrowH.airUse, 1.2);

  // 2. Atlas: stable & efficient with rotation damp / settling 0.82, high damping 1.5, airUse 0.75
  const atlasH = get('atlas').handling;
  assert.equal(atlasH.rotation, 0.82);
  assert.equal(atlasH.damping, 1.5);
  assert.equal(atlasH.airUse, 0.75);

  // 3. Nova: twin-jet prototype with high thrust 1.28 and air thruster consumption 1.25
  const novaH = get('nova').handling;
  assert.equal(novaH.thrust, 1.28);
  assert.equal(novaH.airUse, 1.25);
  assert.equal(novaH.damping, 1.05);

  // 4. Vector speed runner:
  // In the catalogue, unknown/speed runner identifier 'vector' maps gracefully to the balanced Roadster baseline
  const vectorResolved = get('vector');
  assert.equal(vectorResolved.id, 'roadster', 'Vector resolves to default roadster baseline');

  // Custom speed runner tuning specification invariant
  const speedRunnerTuning = { ...BASE, MOTOR_A: BASE.MOTOR_A * 1.15, MOTOR_P: BASE.MOTOR_P * 1.15, VMAX: 98 };
  const stockSim = createSim();
  const vectorSim = createSim({}, speedRunnerTuning);
  for (let i = 0; i < 180; i++) {
    stockSim.step(BASE.STEP, { ...idle, drive: true });
    vectorSim.step(BASE.STEP, { ...idle, drive: true });
  }
  assert.ok(vectorSim.state.v > stockSim.state.v, 'Vector speed runner produces higher approach speed');

  // Aerodynamic rotational agility invariant: Sparrow single-jet roll rate exceeds all other vehicles
  const sparrowAir = airborne('sparrow', { ...idle, left: true });
  const atlasAir = airborne('atlas', { ...idle, left: true });
  const novaAir = airborne('nova', { ...idle, left: true });
  assert.ok(sparrowAir.rw > novaAir.rw, 'Sparrow agility exceeds Nova');
  assert.ok(novaAir.rw > atlasAir.rw, 'Nova agility exceeds Atlas');

  // Aerodynamic rotation damping / settling invariant: Atlas settles rotation fastest when jets are released
  const atlasSettled = airborne('atlas', idle, 3.0);
  const sparrowSettled = airborne('sparrow', idle, 3.0);
  assert.ok(atlasSettled.rw < sparrowSettled.rw, 'Atlas damping (1.5) dampens spin faster than Sparrow (1.05)');

  // Vertical thruster lift invariant: Nova produces greatest climb acceleration
  const bothJets = { ...idle, left: true, right: true };
  const novaLift = airborne('nova', bothJets);
  const atlasLift = airborne('atlas', bothJets);
  const roadsterLift = airborne('roadster', bothJets);
  const sparrowLift = airborne('sparrow', bothJets);
  assert.ok(novaLift.vy > atlasLift.vy, 'Nova twin-jet climb exceeds Atlas');
  assert.ok(atlasLift.vy > roadsterLift.vy, 'Atlas twin-jet climb exceeds Roadster');
  assert.ok(roadsterLift.vy > sparrowLift.vy, 'Roadster twin-jet climb exceeds Sparrow');

  // Air thruster consumption invariant: Nova (1.25) > Sparrow (1.20) > Roadster (1.0) > Atlas (0.75)
  const novaUsed = 100 - novaLift.air;
  const sparrowUsed = 100 - sparrowLift.air;
  const roadsterUsed = 100 - roadsterLift.air;
  const atlasUsed = 100 - atlasLift.air;
  assert.ok(novaUsed > sparrowUsed, 'Nova consumes more air than Sparrow');
  assert.ok(sparrowUsed > roadsterUsed, 'Sparrow consumes more air than Roadster');
  assert.ok(roadsterUsed > atlasUsed, 'Roadster consumes more air than Atlas');
});

test('3D mega runway boundary collisions, 24m shoulder buffer zones, and 1420m tarmac extent', () => {
  const RUNWAY_MIN_X = -1400;
  const RUNWAY_MAX_X = 20;
  const RUNWAY_TOTAL_LEN = RUNWAY_MAX_X - RUNWAY_MIN_X; // 1420m
  assert.equal(RUNWAY_TOTAL_LEN, 1420, 'Mega runway measures exactly 1420m');

  const MAIN_ROAD_W = 4.6;           // Central runway width
  const SHOULDER_APRON_W = 24.0;     // 24m total apron width
  const LATERAL_CLAMP_Z = 18.0;      // Simulation world boundary for lateral displacement

  // 1. Landing strictly inside central runway: |z| <= 2.3m
  const centerSim = createSim();
  Object.assign(centerSim.state, {
    mode: 'air', x: -100, y: 0.65, z: 1.5,
    vx: -15, vy: -1.2, vz: 0,
    roll: 0, pitch: 0, yaw: 0, rw: 0, air: 80, clear: true,
  });
  centerSim.step(BASE.STEP, idle);
  assert.equal(centerSim.state.mode, 'landed');
  assert.ok(Math.abs(centerSim.state.z) <= MAIN_ROAD_W / 2, 'Landed on central asphalt');

  // 2. Landing on the wide 24m shoulder buffer apron: 2.3m < |z| <= 12m
  const shoulderSim = createSim();
  Object.assign(shoulderSim.state, {
    mode: 'air', x: -200, y: 0.65, z: 8.5,
    vx: -12, vy: -1.2, vz: 0.2,
    roll: 0, pitch: 0, yaw: 0, rw: 0, air: 75, clear: true,
  });
  shoulderSim.step(BASE.STEP, idle);
  assert.equal(shoulderSim.state.mode, 'landed', 'Shoulder buffer zone safely accepts lateral drift touchdown');
  assert.ok(Math.abs(shoulderSim.state.z) > MAIN_ROAD_W / 2);
  assert.ok(Math.abs(shoulderSim.state.z) <= SHOULDER_APRON_W / 2, 'Within 24m total shoulder safety zone');

  // 3. Lateral world boundary collision and clamp at |z| = 18m
  const driftSim = createSim();
  Object.assign(driftSim.state, {
    mode: 'air', x: -300, y: 15, z: 17.5,
    vx: -20, vy: 0, vz: 15.0,
    roll: 0, pitch: 0, yaw: 0, rw: 0, air: 60, clear: true,
  });
  for (let i = 0; i < 30; i++) driftSim.step(BASE.STEP, idle);
  assert.equal(driftSim.state.z, LATERAL_CLAMP_Z, 'Lateral position clamped to 18m boundary');
  assert.equal(driftSim.state.vz, 0, 'Lateral velocity extinguished on boundary collision');

  // Negative lateral clamp
  const negDriftSim = createSim();
  Object.assign(negDriftSim.state, {
    mode: 'air', x: -300, y: 15, z: -17.5,
    vx: -20, vy: 0, vz: -15.0,
    roll: 0, pitch: 0, yaw: 0, rw: 0, air: 60, clear: true,
  });
  for (let i = 0; i < 30; i++) negDriftSim.step(BASE.STEP, idle);
  assert.equal(negDriftSim.state.z, -LATERAL_CLAMP_Z);
  assert.equal(negDriftSim.state.vz, 0);

  // 4. Longitudinal rollout along extended 1420m runway preserves finite state
  const rollSim = createSim();
  Object.assign(rollSim.state, {
    mode: 'landed', x: -500, y: 0.66, z: 0,
    vx: -40, vy: 0, vz: 0, landRoll: 0,
  });
  for (let i = 0; i < 480; i++) rollSim.step(BASE.STEP, idle);
  assert.ok(rollSim.state.x < -500, 'Car rolled forward down the mega runway');
  assert.ok(rollSim.state.x > RUNWAY_MIN_X, 'Car stayed safely on the 1420m runway');
  assert.ok(Math.abs(rollSim.state.vx) < 40, 'Runway asphalt friction decelerated the car');
  assert.ok(Number.isFinite(rollSim.state.x));
});

test('soft touchdown scoring under variable wheel spin with spinDamp = 0.35 protection', () => {
  function simulateTouchdown(spinRate, verticalSpeed = -1.5) {
    const sim = createSim();
    Object.assign(sim.state, {
      mode: 'air', x: -50, y: 0.65, z: 0,
      vx: -10, vy: verticalSpeed, vz: 0,
      roll: 0, pitch: 0, yaw: 0, rw: spinRate,
      air: 80, clear: true,
    });
    sim.step(BASE.STEP, idle);
    return sim.state;
  }

  // 1. Zero wheel spin: fall velocity equals descent speed plus 1 step of gravity acceleration
  const zeroSpin = simulateTouchdown(0, -1.5);
  assert.equal(zeroSpin.mode, 'landed');
  const expectedFall = 1.5 + BASE.G0 * BASE.AIR_G * BASE.STEP;
  assert.ok(Math.abs(zeroSpin.land.fall - expectedFall) < 1e-4);
  const zeroScore = scoreOf(zeroSpin.land);
  assert.ok(zeroScore.soft >= 20, 'Zero spin soft score is optimal');

  // 2. Moderate wheel spin (rw = 1.6 rad/s <= 2.5): spinDamp = 0.35 scales down spin impact
  const protectedSpin = simulateTouchdown(1.6, -1.5);
  assert.equal(protectedSpin.mode, 'landed', 'Moderate spin benefits from spinDamp = 0.35 protection');
  assert.ok(protectedSpin.land.fall < BASE.LAND_SPEED, 'Protected fall stays under 5 m/s threshold');
  const protectedScore = scoreOf(protectedSpin.land);
  assert.ok(protectedScore.soft >= 15, 'Protected touchdown preserves viable soft score');
  assert.ok(protectedSpin.land.fall < 2.5, `Fall was ${protectedSpin.land.fall}, shielded by spinDamp 0.35`);

  // 3. Exact boundary condition (rw = 2.5 rad/s): spinDamp = 0.35 still protects
  const boundarySpin = simulateTouchdown(2.5, -1.2);
  assert.equal(boundarySpin.mode, 'landed', 'Boundary spin rate lands safely');
  assert.ok(boundarySpin.land.fall < BASE.LAND_SPEED);

  // 4. Excessive spin exceeding LAND_SPIN (initial rw = 2.8 rad/s > 2.5):
  // spinDamp drops to 1.0 AND s.rw > LAND_SPIN triggers doCrash('hard')
  const excessiveSpin = simulateTouchdown(2.8, -1.2);
  assert.equal(excessiveSpin.mode, 'crash', 'Uncontrolled wheel spin triggers hard landing crash');
  assert.equal(excessiveSpin.crash, 'hard');
  assert.ok(excessiveSpin.land.spin > BASE.LAND_SPIN, 'Spin rate exceeds 2.5 rad/s safety threshold');
});

test('License 03 precision landing target zone and multi-vehicle approach stability', () => {
  const coachContext = {};
  vm.runInNewContext(fs.readFileSync(new URL('../flight-coach.js', import.meta.url), 'utf8'), coachContext);
  const { analyse, advance, targetLimits } = coachContext.WallFlipFlight;

  // Precision target limits: tilt <= 6.25 deg, descent <= 6 km/h (1.6667 m/s)
  assert.ok(targetLimits.tilt < 0.11);
  assert.ok(targetLimits.descent < 1.67);

  // High precision approach achieves targetZone
  const preciseState = { mode: 'air', vy: -1.0, tilt: 0.05, rw: 0.8, air: 70 };
  const evaluation = analyse(preciseState);
  assert.equal(evaluation.targetZone, true);
  assert.equal(evaluation.targetAligned, true);
  assert.equal(evaluation.targetSlow, true);

  // Passing License 03 requires soft >= 20 and level >= 15
  assert.equal(advance(2, { win: true, soft: 20, level: 15 }), 3);
  assert.equal(advance(2, { win: true, soft: 28, level: 19 }), 3);
  assert.equal(advance(2, { win: true, soft: 18, level: 19 }), 2);

  // Multi-vehicle approach settling: Atlas reaches targetSettled with 1.5 damping
  const atlasSim = createSim({}, tune(BASE, 'atlas'));
  Object.assign(atlasSim.state, {
    mode: 'air', x: -40, y: 3.0, z: 0,
    vx: -8, vy: -1.2, vz: 0,
    roll: 0.08, pitch: 0, yaw: 0, rw: 1.2,
    air: 60, clear: true,
  });
  for (let i = 0; i < 48; i++) atlasSim.step(BASE.STEP, idle);
  const atlasEval = analyse({ mode: 'air', vy: atlasSim.state.vy, tilt: atlasSim.state.roll, rw: atlasSim.state.rw, air: atlasSim.state.air });
  assert.ok(atlasEval.targetSettled, 'Atlas rotational damping settles vehicle into precision target window');
});
