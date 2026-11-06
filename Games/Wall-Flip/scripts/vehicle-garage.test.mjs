import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const garageContext = {};
vm.runInNewContext(fs.readFileSync(new URL('../vehicle-garage.js', import.meta.url), 'utf8'), garageContext);
const { vehicles, get, tune, recordKey } = garageContext.WallFlipGarage;
const source = fs.readFileSync(new URL('../index-3d.html', import.meta.url), 'utf8');
const start = source.indexOf('// ---------- utils ----------');
const end = source.indexOf('// ============================================================\n// 3D night scene');
assert.ok(start >= 0 && end > start);
const { BASE, createSim } = vm.runInNewContext(source.slice(start, end) + '\n({BASE,createSim});');
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

function airborne(id, input, spin = 0) {
  const sim = createSim({}, tune(BASE,id));
  Object.assign(sim.state, {mode:'air',x:-100,y:100,roll:0,pitch:0,yaw:0,rw:spin,clear:true});
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
    for(const course of [0,1]) {
      // Only audiovisual side effects are stubbed. Track, jets, collisions and scores are actual game code.
      const context={localStorage:{getItem:()=>null},vehicle,
        window:{WallFlipGarage:garageContext.WallFlipGarage},botOn:true,skids:[],shakeT:0,shakeA:0,
        t:()=>'',say:noop,sayOnce:noop,pop:noop,tireSmoke:noop,dust:noop,smoke:noop,fire:noop,
        confetti:noop,vib:noop,sfx:{land:noop,crash:noop,peel:noop,stuntWhoosh:noop}};
      const api=vm.runInNewContext(code+`
        ({MOTOR_A,MOTOR_P,THRUST,ANG,ROLL_DAMP,SPIN_DAMP,AIR_SUCK,AIR_JET}=window.WallFlipGarage.tune(STOCK_TUNING,vehicle.id));
        buildCourse(${course}); car.x=-RUNUP; car.y=CAR.H;
        ({car,stats,damping:ROLL_DAMP,step(input){Object.assign(inp,input);car.time+=STEP;if(car.mode==='road')stepRoad(STEP);else if(car.mode==='air')stepAir(STEP);}});
      `,context);
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
      assert.equal(api.car.mode,'landed',vehicle.id+' 2D course '+course+' lands');
      assert.equal(api.stats.win,true);
    }
  }
});
