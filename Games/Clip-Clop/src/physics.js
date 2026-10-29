// Shared by the player, AI horses and deterministic logic checks.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const CFG = {
  finishX: 50,
  timeLimit: 90,
  // --- physics aligned with the original game (parameters extracted from its module) ---
  STEP: 1/240,        // simulation substep
  bodyY: 1.193-9.8/(4*70),  // spring-equilibrium body height (~1.158)
  sag: 9.8/280,       // standing compression of the hoof springs
  A_FWD: 0.62,        // rad, swing-forward target angle
  A_BACK: 0,          // rad, return target angle
  SWING: 6.5,         // rad/s, forward swing velocity cap
  PUSH: 4.2,          // rad/s, planted backswing velocity cap (the kick)
  RETURN: 5,          // rad/s, airborne/return velocity cap
  LIFT: 0.34,         // a lifted leg shortens by this much
  LIFT_RATE: 10,      // lift easing rate
  K: 70,              // hoof spring stiffness
  C: 9,               // hoof damper
  TRACTION: 9,        // thrust from backswing, scales with load
  SLIDE: 2.4,         // slide friction while holding a planted hoof
  DRAG: 0.15,         // quadratic drag
  I_PITCH: 0.3,       // pitch moment of inertia
  I_ROLL: 0.05,       // roll moment of inertia
  TIP: 16,            // sideways tip torque (x sin roll)
  TIP_PITCH: 4,       // pitch tip torque (x sin pitch)
  BALANCE: 80,        // balance spring at 3 hooves on the ground
  BAL4: 60,           // at 4 hooves (a three-point stance is actually steadiest)
  BAL2: 6,            // at 2 hooves (nearly nothing: any lean diverges)
  REAR: 0.6,          // nose-up torque = net thrust x body height
  LEG_I: 0.02,        // leg swing inertia reaction on pitch
  COM: 0.1,           // center of mass forward offset
  ANG_DAMP: 2,        // global angular damping
  FALL_ROLL: 0.6,     // rad, sideways fall threshold
  FALL_PITCH: 0.62,   // rad, forward/backward fall threshold
  // fall tumble animation
  FALL_G: 9, ROLL_REST: 1.45, PITCH_REST: 0.55, LIE_MIN: 0.42,
  RISE_TIME: 0.35,    // get-up duration
};
const G_GRAV=9.8;

/* ---- daily challenge: deterministic per-date modifiers + weather ---- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function strHash(str){let h=1779033703;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return h>>>0;}
export function todayStr(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
export function dailyInfo(dateStr){
  const rng=mulberry32(strHash(dateStr||todayStr()));
  const info={
    date:dateStr||todayStr(),
    drag:0.7+rng()*0.5,          // wind: DRAG multiplier 0.7–1.2
    fric:0.85+rng()*0.3,         // ground: TRACTION/SLIDE multiplier
    slope:(rng()*2-1)*0.28,      // m/s^2 along the track (+ downhill)
    weather:'day',
  };
  const w=rng();
  info.weather=w<0.62?'day':w<0.87?'dusk':'rain';
  return info;
}
export const MOD={drag:1,fric:1,slope:0};   // live modifiers (neutral outside daily)
export const LEG_CFG = [
  { key:'KeyQ', side:+1, front:false, color:0xe66900, x:-0.55, y:+0.053, z:+0.18, len:1.25 }, // left hind (longer, hip higher)
  { key:'KeyW', side:-1, front:false, color:0x00b04d, x:-0.55, y:+0.053, z:-0.18, len:1.25 }, // right hind
  { key:'KeyO', side:+1, front:true,  color:0xe356a2, x:+0.56, y:-0.053, z:+0.17, len:1.14 }, // left front
  { key:'KeyP', side:-1, front:true,  color:0x2e91ff, x:+0.56, y:-0.053, z:-0.17, len:1.14 }, // right front
];

export function makeLegStates(){
  return LEG_CFG.map(c=>({cfg:c,th:0,da:0,lift:0,on:true,load:0.25,footX:c.x}));
}
export function makeHorseState(){
  return {x:0,vx:0,y:CFG.bodyY,vy:0,pitch:0,pitchV:0,roll:0,rollV:0,yaw:0,z:0,
          steps:0,topSpeed:0,fallPose:null};
}
function standUpLegs(S,L){
  for(const l of L){l.th=0;l.da=0;l.lift=0;l.on=true;l.load=0.25;l.footX=S.x+l.cfg.x;}
}

// One physics substep. inp = [Q, W, O, P, getup].
export function simHorse(S,L,inp,dt){
  if(S.fallPose)return fallHorse(S,L,inp,dt);
  const ev=[];
  const sinP=Math.sin(S.pitch), cosP=Math.cos(S.pitch);
  const sinR=Math.sin(S.roll),  cosR=Math.cos(S.roll);
  let thrust=0, brake=0, Fsum=0, pitchT=0, rollT=0, nOn=0, sideMask=0, legReact=0;

  for(let i=0;i<4;i++){
    const leg=L[i], c=leg.cfg;
    const keyHeld=!!inp[i];

    // lift eases in/out; a lifted leg shortens, which is what actually lifts the hoof
    leg.lift+=((keyHeld?1:0)-leg.lift)*Math.min(1,CFG.LIFT_RATE*dt);

    const reach=(c.len-CFG.LIFT*leg.lift)*Math.cos(leg.th); // vertical leg reach
    const off=c.x-CFG.COM;                                  // hip x relative to COM
    const hipH=S.y+c.y+off*sinP-c.z*sinR;                   // hip height above ground
    const hipV=S.vy+off*cosP*S.pitchV-c.z*cosR*S.rollV;     // hip vertical velocity
    const wasOn=leg.on;
    leg.on=reach>=hipH;                                     // contact test

    // leg angle chases its target with a velocity cap:
    // held -> swing forward to A_FWD; released -> swing back (the kick) to A_BACK
    let h;
    if(keyHeld){
      h=Math.min(CFG.SWING,(CFG.A_FWD-leg.th)/dt);
      if(leg.th>CFG.A_FWD)h=Math.max(-CFG.RETURN,(CFG.A_FWD-leg.th)/dt);
    }else{
      h=Math.max(-(leg.on?CFG.PUSH:CFG.RETURN),(CFG.A_BACK-leg.th)/dt);
    }
    leg.th+=h*dt;
    legReact+=h-leg.da;   // change of leg angular velocity -> inertia reaction
    leg.da=h;
    leg.load=0;

    if(leg.on){
      const g=Math.max(0,CFG.K*(reach-hipH)-CFG.C*hipV);    // spring-damper strut
      leg.load=g/G_GRAV;
      nOn++;
      sideMask|=c.side>0?1:2;
      Fsum+=g;
      pitchT+=g*off*cosP;    // fore/aft hooves pitch the body
      rollT -=g*c.z*cosR;    // one-sided hooves roll the body away
      const b=Math.min(1.5,leg.load);
      if(keyHeld){
        brake+=CFG.SLIDE*b;                                  // holding a planted hoof makes it slide
      }else{
        thrust+=CFG.TRACTION*b*(-c.len*Math.cos(leg.th)*h);  // backswing kicks the ground
        brake+=CFG.TRACTION*b;
      }
      if(!wasOn){
        leg.footX=S.x+c.x+c.len*Math.sin(leg.th);
        S.steps++;
        ev.push({type:'step',leg:i,speed:Math.min(1,Math.max(0,-hipV)/3),footX:leg.footX,z:c.z});
      }
    }
  }

  /* ---- linear motion ---- */
  S.vx+=(thrust-brake*S.vx-CFG.DRAG*MOD.drag*S.vx*Math.abs(S.vx))*dt;
  S.vx+=MOD.slope*dt;                    // daily hill along the track
  S.vy+=(Fsum-G_GRAV)*dt;
  S.y +=S.vy*dt;
  S.x +=S.vx*dt;

  /* ---- angular motion ---- */
  const net=thrust-brake*S.vx;
  pitchT+=CFG.REAR*net*S.y;                 // thrust pitches the nose up
  S.pitchV-=CFG.LEG_I*legReact/CFG.I_PITCH; // legs accelerating rocks the body
  S.pitchV+=(pitchT/CFG.I_PITCH+CFG.TIP_PITCH*sinP-CFG.ANG_DAMP*S.pitchV)*dt;
  const bal=sideMask===3?[0,0,CFG.BAL2,CFG.BALANCE,CFG.BAL4][nOn]:0;
  S.rollV+=(rollT/CFG.I_ROLL+CFG.TIP*sinR-bal*(S.roll+0.25*S.rollV)-CFG.ANG_DAMP*S.rollV)*dt;
  S.pitch+=S.pitchV*dt;
  S.roll +=S.rollV*dt;
  S.topSpeed=Math.max(S.topSpeed,S.vx);

  /* ---- falls ---- */
  if(Math.abs(S.roll)>CFG.FALL_ROLL||Math.abs(S.pitch)>CFG.FALL_PITCH){
    S.fallPose={
      roll:S.roll, wr:S.rollV, pitch:S.pitch, wp:S.pitchV,
      y:S.y+CFG.sag, t:0, landed:false, rise:0, from:null,
      yaw:0, z:0, vx:S.vx, w:0,
      legs:L.map(l=>({th:l.th,lift:l.lift})),
    };
    ev.push({type:'fall',dir:Math.abs(S.roll)>CFG.FALL_ROLL?(S.roll>0?'left':'right'):(S.pitch>0?'back':'nose')});
  }
  return ev;
}

// Tumble, lying flail and rise — runs on the fall pose.
function fallHorse(S,L,inp,dt){
  const ev=[];
  const p=S.fallPose;

  // rising back to the feet over RISE_TIME, then resume normal simulation
  if(p.rise>0){
    p.rise=Math.min(1,p.rise+dt/CFG.RISE_TIME);
    if(p.rise>=1){
      S.roll=0; S.pitch=0; S.rollV=0; S.pitchV=0;
      S.vx=0; S.vy=0; S.y=CFG.bodyY; S.yaw=0; S.z=0;
      standUpLegs(S,L);
      S.fallPose=null;
      ev.push({type:'up'});
    }
    return ev;
  }

  // tumble: gravity spins the body until it settles at the lying pose (with a bounce)
  p.wr+=CFG.FALL_G*Math.sin(p.roll)*dt;
  p.wp+=CFG.FALL_G*0.5*Math.sin(p.pitch)*dt;
  p.wr*=Math.exp(-0.8*dt);
  p.wp*=Math.exp(-0.8*dt);
  p.roll+=p.wr*dt;
  p.pitch+=p.wp*dt;
  const bounce=(ang,vel,limit)=>{
    if(Math.abs(ang)<limit)return[ang,vel];
    if(Math.abs(vel)>1.5&&Math.sign(vel)===Math.sign(ang))ev.push({type:'thud'});
    return[Math.sign(ang)*limit,Math.sign(vel)===Math.sign(ang)?-vel*0.2:vel];
  };
  [p.roll,p.wr]=bounce(p.roll,p.wr,CFG.ROLL_REST);
  [p.pitch,p.wp]=bounce(p.pitch,p.wp,CFG.PITCH_REST);
  const ar=Math.abs(p.roll);
  p.y=Math.max(CFG.LIE_MIN,1.193*Math.cos(p.roll)*Math.cos(p.pitch)+0.17*Math.sin(ar));
  p.t+=dt;
  if(!p.landed&&(ar>=CFG.ROLL_REST*0.95||Math.abs(p.pitch)>=CFG.PITCH_REST*0.95||p.t>1.2)){
    p.landed=true;
    ev.push({type:'landed'});
  }

  // flail: the keys still paddle the legs while lying down, and once rolled over
  // fully, paddling drags the body along and spins it around — just like the original
  const u=Math.sign(p.roll), full=ar>1;
  for(let i=0;i<4;i++){
    const lp=p.legs[i], c=LEG_CFG[i];
    const heldNow=!!inp[i];
    lp.lift+=((heldNow?1:0)-lp.lift)*Math.min(1,10*dt);
    const v=clamp(((heldNow?0.9:-0.4)-lp.th)/dt,-5,7);
    lp.th+=v*dt;
    if(full&&c.z*u>0&&lp.lift<0.5){
      p.vx-=v*0.45*dt;
      p.w+=v*(c.front?1:-1)*u*0.9*dt;
    }
  }
  p.vx*=Math.exp(-2.5*dt);
  p.w*=Math.exp(-2.5*dt);
  p.yaw+=p.w*dt;
  S.x+=p.vx*Math.cos(p.yaw)*dt;
  p.z=clamp(p.z-p.vx*Math.sin(p.yaw)*dt,-1.5,1.5);
  S.yaw=p.yaw; S.z=p.z;

  // get-up request (player: R key path; AI: driver raises inp[4] once landed)
  if(inp[4]&&p.landed&&!p.rise){
    p.rise=1e-6;
    p.from={roll:p.roll,pitch:p.pitch,y:p.y,yaw:p.yaw,z:p.z};
    ev.push({type:'getup'});
  }
  return ev;
}
