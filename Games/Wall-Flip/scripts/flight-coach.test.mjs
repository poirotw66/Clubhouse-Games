import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const sandbox = {};
vm.runInNewContext(fs.readFileSync(new URL('../flight-coach.js', import.meta.url), 'utf8'), sandbox);
const { analyse, advance, tiltOf, limits } = sandbox.WallFlipFlight;

test('wheels-down angle preserves full-turn parity and includes 3D pitch', () => {
  for (const angle of [0, Math.PI * 2, -Math.PI * 4]) assert.ok(tiltOf(angle) < 1e-8);
  assert.ok(Math.abs(tiltOf(Math.PI) - Math.PI) < 1e-8);
  assert.equal(tiltOf(0, -0.7), 0.7);
});
test('stage coaching responds to actual motion and the overhang', () => {
  const road = Object.freeze({mode:'road',u:-10,th:0,air:100});
  assert.equal(analyse(road).action,'drive');
  assert.equal(analyse({...road,u:1,th:0.5}).action,'prepare');
  assert.equal(analyse({...road,u:20,th:2}).action,'stick');
  assert.equal(analyse({mode:'air',vy:2,tilt:0,rw:0,air:80}).stage,'climb');
  assert.equal(analyse({mode:'air',vy:-2,tilt:0,rw:0,air:80}).stage,'descent');
  assert.equal(analyse({mode:'air',vy:-8,tilt:Math.PI,rw:0,air:80}).action,'level', 'Never advise inverted braking');
});
test('landing envelope uses original physical thresholds; no probability or auto control', () => {
  const air = Object.freeze({mode:'air',vy:-limits.descent,tilt:limits.tilt,rw:-limits.spin,air:50});
  const state = analyse(air);
  assert.equal(state.aligned,true);assert.equal(state.slow,true);assert.equal(state.settled,true);
  assert.equal(analyse({...air,tilt:limits.tilt+0.001}).aligned,false);
  assert.equal(analyse({...air,vy:-limits.descent-0.001}).slow,false);
  assert.equal(analyse({...air,rw:limits.spin+0.001}).settled,false);
  assert.equal(analyse({...air,tilt:0,rw:0,vy:-8}).action,'brake');
  assert.equal(analyse({...air,air:0}).action,'empty');
  assert.equal(air.vy,-5);assert.equal(air.air,50);
});
test('license progress requires successful real outcomes and only one objective per run', () => {
  const perfect = Object.freeze({win:true,rolls:5,soft:30,level:20,total:999});
  assert.equal(advance(0,{...perfect,win:false}),0);
  assert.equal(advance(0,perfect),1, 'A good first run cannot skip objectives');
  assert.equal(advance(1,{...perfect,rolls:0}),1);
  assert.equal(advance(1,{...perfect,rolls:1}),2);
  assert.equal(advance(2,{...perfect,soft:19.99}),2);
  assert.equal(advance(2,{...perfect,level:14.99}),2);
  assert.equal(advance(2,{...perfect,soft:20,level:15}),3);
  assert.equal(advance(3,perfect),3);
  assert.equal(perfect.total,999, 'The skill loop must not modify original score data');
});
