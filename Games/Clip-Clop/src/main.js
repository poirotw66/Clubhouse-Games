import * as THREE from 'three';

/* ================================================================
   Config & tuning
================================================================ */
const CFG = {
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

const LEG_CFG = [
  { key:'KeyQ', side:+1, front:false, color:0xe66900, x:-0.55, y:+0.053, z:+0.18, len:1.25 }, // left hind (longer, hip higher)
  { key:'KeyW', side:-1, front:false, color:0x00b04d, x:-0.55, y:+0.053, z:-0.18, len:1.25 }, // right hind
  { key:'KeyO', side:+1, front:true,  color:0xe356a2, x:+0.56, y:-0.053, z:+0.17, len:1.14 }, // left front
  { key:'KeyP', side:-1, front:true,  color:0x2e91ff, x:+0.56, y:-0.053, z:-0.17, len:1.14 }, // right front
];

/* ================================================================
   i18n (zh-Hant primary, en secondary)
================================================================ */
const I18N = {
  zh: {
    title:'達達馬蹄', subtitle:'CLIP-CLOP HORSE',
    tagline:'一款令人又氣又笑的四腿平衡賽馬遊戲',
    goal:'在 90 秒內跑完 50 公尺！',
    how1:'按住 Q／W／O／P：抬起對應的馬腿並向前擺動',
    how2:'放開按鍵：馬腿落地，順勢向後踢地推進',
    how3:'身體傾斜過頭就會跌倒，按 R 起身',
    tip:'訣竅：對角線兩腳快速輪替，千萬別四腳同時離地！',
    start:'按 Space 起跑！',
    credit:'靈感致敬：tsuyatt《おうまパカパカ Clip-Clop》',
    hud_time:'時間', hud_dist:'剩餘', hud_falls:'跌倒',
    fallen:'跌倒了！按 R 起身',
    result_title:'RESULT · 比賽結果', rank_label:'RANK · 稱號',
    st_time:'用時（秒）', st_falls:'跌倒次數', st_steps:'總步數', st_speed:'最高時速',
    dnf:'時間到！', retry:'按 Space 再跑一次',
    legQ:'左後', legW:'右後', legO:'左前', legP:'右前',
    ranks:['傳奇賽馬','賽馬','小馬','新生小馬'],
    tip_warn:'快倒了！', practice:'練習模式',
    board:'排行榜 · 成就', board_title:'LEADERBOARD · 排行榜', ach_title:'ACHIEVEMENTS · 成就',
    close:'關閉', new_record:'★ 新紀錄！',
    save_score:'存入排行', name_ph:'你的名字',
    share:'分享', copied:'已複製戰報！', board_empty:'還沒有任何紀錄，去跑一場吧！',
    practice_note:'練習模式：不計時不計紀錄',
    ach:{first:'初次完賽',legend:'傳奇賽馬',race:'賽馬等級',clean:'零跌倒完賽',sprint:'極速奔馳',tumble:'摔出名堂',marathon:'長跑健將'},
    achDesc:{first:'完成一場 50m',legend:'22 秒內完賽',race:'32 秒內完賽',clean:'完賽且零跌倒',sprint:'時速達 9 km/h',tumble:'累計跌倒 10 次',marathon:'累計跑 500m'},
  },
  en: {
    title:'Clip-Clop', subtitle:'CLIP-CLOP HORSE',
    tagline:'A maddening four-leg balancing race',
    goal:'Gallop 50 m within 90 seconds!',
    how1:'Hold Q/W/O/P to lift that leg and swing it forward',
    how2:'Release the key: the hoof stamps down and kicks back',
    how3:'Tilt too far and you fall — press R to get up',
    tip:'Tip: swap diagonal pairs quickly. Never lift all four legs at once!',
    start:'Press SPACE to start!',
    credit:'Homage to "Clip-Clop / Oumapakapaka" by tsuyatt',
    hud_time:'TIME', hud_dist:'TO GO', hud_falls:'FALLS',
    fallen:'Whoops! Press R to get up',
    result_title:'RESULT', rank_label:'RANK',
    st_time:'Time (s)', st_falls:'Falls', st_steps:'Steps', st_speed:'Top speed',
    dnf:"TIME'S UP!", retry:'Press SPACE to run again',
    legQ:'L-hind', legW:'R-hind', legO:'L-front', legP:'R-front',
    ranks:['Legendary Racehorse','Racehorse','Pony','Foal'],
    tip_warn:'Tilting!', practice:'Practice',
    board:'Leaderboard · Achievements', board_title:'LEADERBOARD', ach_title:'ACHIEVEMENTS',
    close:'Close', new_record:'★ NEW RECORD!',
    save_score:'Save score', name_ph:'Your name',
    share:'Share', copied:'Result copied!', board_empty:'No records yet — go run one!',
    practice_note:'Practice: untimed, unranked',
    ach:{first:'First Finish',legend:'Legendary',race:'Racehorse',clean:'Clean Run',sprint:'Full Gallop',tumble:'Seasoned Tumbler',marathon:'Distance Runner'},
    achDesc:{first:'Finish a 50 m race',legend:'Finish under 22 s',race:'Finish under 32 s',clean:'Finish with zero falls',sprint:'Reach 9 km/h',tumble:'Fall 10 times in total',marathon:'Run 500 m in total'},
  },
};
let lang = localStorage.getItem('cc_lang') || 'zh';
const tr = k => (I18N[lang] && I18N[lang][k]) || I18N.zh[k] || k;
function applyI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = tr(el.dataset.i18nPh); });
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  langBtn.textContent = lang === 'zh' ? 'EN' : '中';
}

/* ================================================================
   DOM refs
================================================================ */
const $ = id => document.getElementById(id);
const hudEl=$('hud'), hudTime=$('hudTime'), hudDist=$('hudDist'), hudFalls=$('hudFalls'),
      fallsPill=$('fallsPill'), langBtn=$('langBtn'), muteBtn=$('muteBtn'), ghostBtn=$('ghostBtn'),
      fallPromptEl=$('fallPrompt'), goBanner=$('goBanner'), countNumEl=$('countNum'), keysBar=$('keysBar'),
      tipWarnEl=$('tipWarn'),
      titleScreen=$('titleScreen'), startBtn=$('startBtn'), practiceBtn=$('practiceBtn'),
      boardBtn=$('boardBtn'), boardScreen=$('boardScreen'), boardClose=$('boardClose'),
      resultScreen=$('resultScreen'), dnfBadge=$('dnfBadge'), newRecordEl=$('newRecord'),
      nameRow=$('nameRow'), nameInput=$('nameInput'), saveScoreBtn=$('saveScoreBtn'),
      achToastRow=$('achToastRow'), shareBtn=$('shareBtn'),
      rankText=$('rankText'), rankIcon=$('rankIcon'),
      stTime=$('stTime'), stFalls=$('stFalls'), stSteps=$('stSteps'), stSpeed=$('stSpeed'),
      retryBtn=$('retryBtn'), loadingEl=$('loading');

/* ================================================================
   Sound (WebAudio, fully synthesized)
================================================================ */
class Sfx {
  constructor(){ this.ctx=null; this.muted = localStorage.getItem('cc_mute')==='1'; this.noiseBuf=null; }
  ensure(){
    if(!this.ctx){
      try{
        this.ctx = new (window.AudioContext||window.webkitAudioContext)();
        const len = this.ctx.sampleRate*0.5, buf = this.ctx.createBuffer(1,len,this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
        this.noiseBuf = buf;
      }catch(e){ this.ctx=null; }
    }
    if(this.ctx && this.ctx.state==='suspended') this.ctx.resume();
  }
  ok(){ return this.ctx && !this.muted; }
  tone(type,f0,f1,dur,vol,when=0){
    const c=this.ctx, t=c.currentTime+when;
    const o=c.createOscillator(), g=c.createGain();
    o.type=type; o.frequency.setValueAtTime(f0,t);
    if(f1!==f0) o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
    g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t+dur+0.02);
  }
  noise(freq,q,dur,vol,when=0){
    const c=this.ctx, t=c.currentTime+when;
    const s=c.createBufferSource(); s.buffer=this.noiseBuf;
    const f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=freq; f.Q.value=q;
    const g=c.createGain();
    g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    s.connect(f).connect(g).connect(c.destination);
    s.start(t); s.stop(t+dur+0.02);
  }
  clop(p=1){ if(!this.ok())return;
    this.noise(1600+Math.random()*700, 1.4, 0.05, 0.20*p);
    this.tone('sine', 150+60*p, 65, 0.09, 0.35*p);
  }
  thud(){ if(!this.ok())return; this.tone('sine',95,40,0.25,0.55); this.noise(300,0.8,0.12,0.25); }
  fall(){ if(!this.ok())return;
    this.tone('sawtooth',260,70,0.35,0.22);
    this.tone('sine',95,40,0.3,0.5,0.28);
    this.noise(500,0.7,0.2,0.3,0.28);
  }
  getup(){ if(!this.ok())return; this.clop(0.6); this.clop(0.8); }
  go(){ if(!this.ok())return; this.tone('square',660,660,0.08,0.14); this.tone('square',880,880,0.14,0.14,0.1); }
  beep(){ if(!this.ok())return; this.tone('square',880,880,0.07,0.13); }
  buzz(){ if(!this.ok())return; this.tone('square',150,110,0.6,0.2); }
  fanfare(){ if(!this.ok())return;
    [523.25,659.25,783.99,1046.5].forEach((f,i)=>this.tone('triangle',f,f,0.22,0.2,i*0.12));
  }
}
const sfx = new Sfx();

/* ================================================================
   Three.js scene / world
================================================================ */
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.body.insertBefore(renderer.domElement, document.getElementById('ui'));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd8f5);
scene.fog = new THREE.Fog(0xbfe4f7, 30, 95);

const camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 0.1, 220);
camera.position.set(-4.6,2.1,4.2);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7a9b58, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-9; sun.shadow.camera.right=9;
sun.shadow.camera.top=9;  sun.shadow.camera.bottom=-9;
sun.shadow.camera.near=1; sun.shadow.camera.far=45;
sun.shadow.normalBias=0.03;
scene.add(sun); scene.add(sun.target);

function buildWorld(){
  // grass
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500,400),
    new THREE.MeshStandardMaterial({color:0x7cab58, roughness:1}));
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  // dirt track
  const track = new THREE.Mesh(
    new THREE.BoxGeometry(96,0.06,4.6),
    new THREE.MeshStandardMaterial({color:0xc09a6a, roughness:1}));
  track.position.set(25,0.03,0);
  track.receiveShadow = true;
  scene.add(track);

  // start strip
  const start = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.02,4.4),
    new THREE.MeshStandardMaterial({color:0xf2ead8}));
  start.position.set(0,0.065,0); scene.add(start);

  // fences both sides (instanced posts)
  const fenceMat = new THREE.MeshStandardMaterial({color:0xf2ead8, roughness:.9});
  {
    const posts=[];
    for(const zs of [-2.75,2.75])for(let x=-12;x<=62;x+=4)posts.push([x,0.42,zs]);
    const postGeo=new THREE.CylinderGeometry(0.05,0.05,0.85,8);
    const postIM=new THREE.InstancedMesh(postGeo,fenceMat,posts.length);
    const dummy=new THREE.Object3D();
    posts.forEach((p,i)=>{dummy.position.set(p[0],p[1],p[2]);dummy.updateMatrix();postIM.setMatrixAt(i,dummy.matrix);});
    postIM.castShadow=true;
    scene.add(postIM);
    for(const zs of [-2.75,2.75])for(const h of [0.33,0.62]){
      const r = new THREE.Mesh(new THREE.BoxGeometry(74,0.07,0.06), fenceMat);
      r.position.set(25,h,zs); scene.add(r);
    }
  }

  // distance boards every 10 m
  function boardTexture(txt){
    const cv=document.createElement('canvas'); cv.width=128; cv.height=80;
    const g=cv.getContext('2d');
    g.fillStyle='#fff6e8'; g.fillRect(0,0,128,80);
    g.strokeStyle='#4a2f18'; g.lineWidth=8; g.strokeRect(4,4,120,72);
    g.fillStyle='#4a2f18'; g.font='800 34px "Baloo 2", sans-serif';
    g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,64,42);
    const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t;
  }
  for(let d=10; d<=50; d+=10){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.1,8),fenceMat);
    post.position.set(d,0.55,-3.3); scene.add(post);
    const b=new THREE.Mesh(new THREE.BoxGeometry(0.74,0.46,0.05),
      new THREE.MeshStandardMaterial({map:boardTexture(d+' m')}));
    b.position.set(d,1.25,-3.3); b.rotation.y=-0.7; b.castShadow=true; scene.add(b);
  }

  // finish gate
  function checkerTexture(w,h,s){
    const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
    const g=cv.getContext('2d');
    for(let y=0;y<h;y+=s)for(let x=0;x<w;x+=s){
      g.fillStyle=((x+y)/s)%2?'#222':'#f5f0e6'; g.fillRect(x,y,s,s);
    }
    const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t;
  }
  for(const zs of [-2.9,2.9]){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,2.9,10),fenceMat);
    p.position.set(50,1.45,zs); p.castShadow=true; scene.add(p);
  }
  const banner=new THREE.Mesh(new THREE.PlaneGeometry(5.8,1.0),
    new THREE.MeshStandardMaterial({map:checkerTexture(512,96,24), side:THREE.DoubleSide}));
  banner.position.set(50,2.55,0); banner.rotation.y=-Math.PI/2+0.2; scene.add(banner);
  const stripTex=checkerTexture(64,512,32);
  stripTex.wrapS=stripTex.wrapT=THREE.RepeatWrapping; stripTex.repeat.set(1,7);
  const strip=new THREE.Mesh(new THREE.PlaneGeometry(0.9,4.5),
    new THREE.MeshStandardMaterial({map:stripTex}));
  strip.rotation.x=-Math.PI/2; strip.position.set(50,0.062,0); scene.add(strip);

  // trees / bushes / grass patches — instanced for low draw-call cost
  const trunkMat=new THREE.MeshStandardMaterial({color:0x7d5a3a,roughness:1});
  const leafA=new THREE.MeshStandardMaterial({color:0x3f7d3c,roughness:1});
  const leafB=new THREE.MeshStandardMaterial({color:0x55934b,roughness:1});
  {
    const dummy=new THREE.Object3D();
    const trunks=[],cones=[],balls=[],bushes=[],patches=[];
    for(let i=0;i<30;i++){
      const x=-14+Math.random()*80;
      // Trees on the camera side (+z) stay beyond the furthest chase-cam distance
      // (15 m) so they can never block the view of the track; the far side keeps
      // its close greenery since it only ever shows as background.
      const side=Math.random()<0.5?-1:1;
      const z=side<0 ? -(4.8+Math.random()*28) : (16.5+Math.random()*16);
      const s=0.8+Math.random()*0.6;
      trunks.push({x,y:0.6*s,z,s});
      if(Math.random()<0.5)cones.push({x,y:2.2*s,z,s});
      else balls.push({x,y:1.75*s,z,s,sy:1.15});
    }
    for(let i=0;i<10;i++){
      bushes.push({x:-8+Math.random()*66,y:0.22,z:(3.5+Math.random()*0.9)*(Math.random()<0.5?-1:1),s:0.3+Math.random()*0.2,sy:0.8});
    }
    for(let i=0;i<24;i++){
      patches.push({x:-15+Math.random()*85,y:0.012+i*0.0002,z:(Math.random()*30+4)*(Math.random()<0.5?-1:1),s:0.8+Math.random()*1.6});
    }
    const inst=(geo,mat,list)=>{
      if(!list.length)return;
      const im=new THREE.InstancedMesh(geo,mat,list.length);
      list.forEach((t,i)=>{
        dummy.position.set(t.x,t.y,t.z);
        dummy.scale.set(t.s,t.sy!==undefined?t.sy:t.s,t.s);
        dummy.rotation.set(0,0,0);
        dummy.updateMatrix();
        im.setMatrixAt(i,dummy.matrix);
      });
      im.castShadow=true;
      im.instanceMatrix.needsUpdate=true;
      scene.add(im);
    };
    inst(new THREE.CylinderGeometry(0.12,0.16,1.2,7),trunkMat,trunks);
    inst(new THREE.ConeGeometry(0.95,2.3,8),leafA,cones);
    inst(new THREE.SphereGeometry(0.95,10,8),leafB,balls);
    inst(new THREE.SphereGeometry(1,8,6),leafB,bushes);
    const patchIM=new THREE.InstancedMesh(
      new THREE.CircleGeometry(1,10),
      new THREE.MeshBasicMaterial({color:0x6f9e4f,transparent:true,opacity:0.45,depthWrite:false}),
      patches.length);
    patches.forEach((t,i)=>{
      dummy.position.set(t.x,t.y,t.z);
      dummy.scale.set(t.s,t.s,1);
      dummy.rotation.set(-Math.PI/2,0,0);
      dummy.updateMatrix();
      patchIM.setMatrixAt(i,dummy.matrix);
    });
    patchIM.instanceMatrix.needsUpdate=true;
    patchIM.renderOrder=1;
    scene.add(patchIM);
  }
}
const clouds=[];
function buildClouds(){
  const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
  for(let i=0;i<7;i++){
    const g=new THREE.Group();
    for(let j=0;j<3;j++){
      const s=new THREE.Mesh(new THREE.SphereGeometry(1.1+Math.random()*0.7,10,8),m);
      s.position.set(j*1.4-1.4+Math.random(), Math.random()*0.4, Math.random()*0.8);
      s.scale.y=0.55; g.add(s);
    }
    g.position.set(-10+Math.random()*85, 11+Math.random()*6, -30+Math.random()*60);
    scene.add(g); clouds.push(g);
  }
}

/* ================================================================
   Horse
================================================================ */
const horseRoot = new THREE.Group();
const tilt = new THREE.Group();
tilt.position.y = CFG.bodyY;
horseRoot.add(tilt);
scene.add(horseRoot);

const legs = [];   // {cfg, th, da, lift, on, load, footX}
let neckRef=null, headRef=null;
const tailSegs=[]; // segmented tail, reacts to speed like the original

// Builds a complete horse. ghost=true renders a translucent shadow-free copy
// used for the best-run replay.
function buildHorseMesh(root, tiltG, ghost){
  const M=(color,rough)=>ghost
    ? new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:0.28,roughness:.8,depthWrite:false})
    : new THREE.MeshStandardMaterial({color,roughness:rough});
  const bodyMat  = M(0xdedad0,.85);
  const legMat   = M(0xcfc9bd,.85);
  const darkMat  = M(0x9b958a,.9);
  const muzzleMat= M(0xe9e4da,.9);
  const eyeMat   = ghost?bodyMat:M(0x1d1410,.4);
  const saddleMat= ghost?bodyMat:M(0x8c3b2e,.7);
  const blanketMat=ghost?bodyMat:M(0xf2e2c4,.9);
  const out={legs:[],tailSegs:[]};

  const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.36,0.85,6,14),bodyMat);
  body.rotation.z=Math.PI/2; tiltG.add(body);
  const chest=new THREE.Mesh(new THREE.SphereGeometry(0.34,14,12),bodyMat);
  chest.position.set(0.42,0.02,0); tiltG.add(chest);
  const rump=new THREE.Mesh(new THREE.SphereGeometry(0.33,14,12),bodyMat);
  rump.position.set(-0.42,0.03,0); tiltG.add(rump);

  // saddle + blanket + girth (skip on the ghost to keep it readable)
  if(!ghost){
    const blanket=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.05,0.5),blanketMat);
    blanket.position.set(-0.02,0.35,0); tiltG.add(blanket);
    const saddle=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.1,0.3),saddleMat);
    saddle.position.set(-0.02,0.4,0); tiltG.add(saddle);
    const girth=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.72,0.05),darkMat);
    girth.position.set(-0.05,0,0); tiltG.add(girth);
  }

  // neck + head
  const neck=new THREE.Group(); neck.position.set(0.52,0.22,0);
  neck.rotation.z=-0.72; tiltG.add(neck);
  out.neck=neck;
  const neckM=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.58,0.22),bodyMat);
  neckM.position.y=0.26; neck.add(neckM);
  for(let i=0;i<3;i++){ // segmented mane
    const mane=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.24,0.26-0.04*i),darkMat);
    mane.position.set(-0.15,0.13+i*0.17,0); neck.add(mane);
  }

  const head=new THREE.Group(); head.position.set(0,0.58,0);
  head.rotation.z=0.85; neck.add(head);
  out.head=head;
  const skull=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.24,0.2),bodyMat);
  skull.position.set(0.05,0.02,0); head.add(skull);
  const muzzle=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.17,0.16),muzzleMat);
  muzzle.position.set(0.26,-0.02,0); head.add(muzzle);
  if(!ghost){
    for(const zs of [-0.045,0.045]){ // nostrils
      const n=new THREE.Mesh(new THREE.SphereGeometry(0.018,6,5),eyeMat);
      n.position.set(0.365,-0.02,zs); head.add(n);
    }
  }
  for(const zs of [-0.07,0.07]){
    const ear=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.16,6),bodyMat);
    ear.position.set(-0.05,0.19,zs); ear.rotation.x=zs>0?-0.25:0.25;
    head.add(ear);
  }
  for(const zs of [-0.105,0.105]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(0.035,8,6),eyeMat);
    eye.position.set(0.13,0.05,zs); head.add(eye);
  }

  // segmented tail: each joint reacts to speed / vertical motion
  let parent=tiltG, py=0.28, px=-0.7;
  for(let i=0;i<4;i++){
    const seg=new THREE.Group();
    seg.position.set(i===0?px:0, i===0?py:-0.16, 0);
    if(i===0)seg.rotation.z=-0.5;
    parent.add(seg);
    const len=i===3?0.2:0.16;
    const m=new THREE.Mesh(new THREE.CylinderGeometry(0.02+i*0.006,i===3?0.02:0.065+i*0.004,len,8),darkMat);
    m.position.y=-len/2; seg.add(m);
    out.tailSegs.push(seg);
    parent=seg;
  }

  // legs with colored bands; front legs are shorter with lower hips, like the original
  for(const c of LEG_CFG){
    const hip=new THREE.Group();
    hip.position.set(c.x, c.y, c.z);
    tiltG.add(hip);
    const upLen=c.len*0.51, loLen=c.len*0.49;
    const upper=new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.085,upLen,10),legMat);
    upper.position.y=-upLen/2; hip.add(upper);
    const knee=new THREE.Group(); knee.position.y=-upLen; hip.add(knee);
    const lower=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.06,loLen,10),legMat);
    lower.position.y=-loLen/2; knee.add(lower);
    const band=new THREE.Mesh(new THREE.CylinderGeometry(0.105,0.105,0.13,12),
      ghost?bodyMat:new THREE.MeshStandardMaterial({color:c.color,roughness:.5}));
    band.position.y=-loLen*0.48; knee.add(band);
    const hoof=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.09,0.11,10),darkMat);
    hoof.position.y=-loLen*0.97; knee.add(hoof);

    out.legs.push({cfg:c, hip, knee, band, th:0, da:0, lift:0, on:true, load:0.25, footX:c.x});
  }

  if(!ghost)root.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  return out;
}

let horseParts=null;
function buildHorse(){
  horseParts=buildHorseMesh(horseRoot,tilt,false);
  for(const l of horseParts.legs)legs.push(l);
  neckRef=horseParts.neck; headRef=horseParts.head;
  for(const s of horseParts.tailSegs)tailSegs.push(s);
}

/* ================================================================
   Dust puffs
================================================================ */
const dustPool=[];
function buildDust(){
  const cv=document.createElement('canvas'); cv.width=64; cv.height=64;
  const g=cv.getContext('2d');
  const gr=g.createRadialGradient(32,32,4,32,32,30);
  gr.addColorStop(0,'rgba(150,115,75,0.65)');
  gr.addColorStop(1,'rgba(150,115,75,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64);
  const tex=new THREE.CanvasTexture(cv);
  for(let i=0;i<16;i++){
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
    s.visible=false; scene.add(s);
    dustPool.push({s, age:0, life:0});
  }
}
function dustAt(x,z,n=1){
  for(let i=0;i<n;i++){
    const d=dustPool.find(d=>!d.s.visible); if(!d)return;
    d.s.visible=true; d.age=0; d.life=0.4+Math.random()*0.15;
    d.s.position.set(x+(Math.random()-0.5)*0.3, 0.08, z+(Math.random()-0.5)*0.3);
  }
}
function updateDust(dt){
  for(const d of dustPool){
    if(!d.s.visible)continue;
    d.age+=dt;
    if(d.age>=d.life){ d.s.visible=false; continue; }
    const k=d.age/d.life, sc=0.28+k*1.15;
    d.s.scale.set(sc,sc,1);
    d.s.material.opacity=0.55*(1-k);
    d.s.position.y=0.08+k*0.35;
  }
}

/* ================================================================
   Hoof prints (ground decals, recycled pool)
================================================================ */
const printPool=[];
function buildHoofprints(){
  const geo=new THREE.CircleGeometry(0.055,8);
  const mat=new THREE.MeshBasicMaterial({color:0x8a6a48,transparent:true,opacity:0.4,depthWrite:false});
  for(let i=0;i<90;i++){
    const m=new THREE.Mesh(geo,mat.clone());
    m.rotation.x=-Math.PI/2;
    m.scale.set(1,1.5,1);
    m.visible=false; m.renderOrder=1;
    scene.add(m);
    printPool.push(m);
  }
}
let printIdx=0;
function printAt(x,z){
  const m=printPool[printIdx++%printPool.length];
  m.visible=true;
  m.material.opacity=0.4;
  m.position.set(x,0.006+(printIdx%7)*0.0004,z);
  m.rotation.z=Math.random()*Math.PI;
}

/* ================================================================
   Finish confetti
================================================================ */
const confetti=[];
function buildConfetti(){
  const colors=[0xe66900,0x00b04d,0xe356a2,0x2e91ff,0xf5d90a,0xffffff];
  const geo=new THREE.PlaneGeometry(0.08,0.13);
  for(let i=0;i<70;i++){
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({
      color:colors[i%colors.length],side:THREE.DoubleSide,transparent:true}));
    m.visible=false; scene.add(m);
    confetti.push({m,vx:0,vy:0,vz:0,spin:0,age:0,life:0});
  }
}
function burstConfetti(x,z){
  let n=0;
  for(const c of confetti){
    if(c.m.visible)continue;
    if(++n>60)break;
    c.m.visible=true; c.age=0; c.life=2.2+Math.random()*1.2;
    c.m.position.set(x+(Math.random()-0.5)*2.5, 2.6+Math.random()*1.6, z+(Math.random()-0.5)*2.5);
    c.vx=(Math.random()-0.5)*1.6; c.vy=1+Math.random()*2.4; c.vz=(Math.random()-0.5)*1.6;
    c.spin=3+Math.random()*7;
    c.m.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);
  }
}
function updateConfetti(dt){
  for(const c of confetti){
    if(!c.m.visible)continue;
    c.age+=dt;
    if(c.age>=c.life){c.m.visible=false;continue;}
    c.vy-=2.6*dt; c.vy=Math.max(c.vy,-1.2);   // flutter down
    c.m.position.x+=c.vx*dt; c.m.position.y+=c.vy*dt; c.m.position.z+=c.vz*dt;
    c.m.rotation.x+=c.spin*dt; c.m.rotation.z+=c.spin*0.6*dt;
    c.m.material.opacity=Math.min(1,(c.life-c.age)/0.6);
  }
}

/* ================================================================
   Crowd at the finish line
================================================================ */
const crowd=[];
function buildCrowd(){
  const shirt=[0xe66900,0x00b04d,0xe356a2,0x2e91ff,0xf2c94c,0x9b51e0];
  for(let i=0;i<12;i++){
    const g=new THREE.Group();
    const side=i<6?-1:1;
    g.position.set(48.2+Math.random()*3.6, 0, side*(3.3+Math.random()*1.1));
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.5,0.16),
      new THREE.MeshStandardMaterial({color:shirt[i%shirt.length],roughness:.9}));
    body.position.y=0.25; body.castShadow=true; g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6),
      new THREE.MeshStandardMaterial({color:0xe8c39e,roughness:.9}));
    head.position.y=0.62; g.add(head);
    g.rotation.y=-side*0.9+Math.random()*0.3;
    scene.add(g);
    crowd.push({g,phase:Math.random()*6});
  }
}
function updateCrowd(dt,near){
  for(const c of crowd){
    const amp=near?0.09:0.02, spd=near?9:2;
    c.g.position.y=Math.abs(Math.sin(animT*spd+c.phase))*amp;
  }
}

/* ================================================================
   Ghost horse (best-run replay)
================================================================ */
const ghostRoot=new THREE.Group();
const ghostTilt=new THREE.Group();
ghostTilt.position.y=CFG.bodyY;
ghostRoot.add(ghostTilt);
ghostRoot.visible=false;
scene.add(ghostRoot);
let ghostParts=null;
function buildGhost(){
  ghostParts=buildHorseMesh(ghostRoot,ghostTilt,true);
}

// True hoof sync: knee bend is solved so the leg's visual reach matches the
// physics reach exactly — lifted hooves really leave the ground. The knee folds
// backward (away from the swing direction), like a real horse.
function applyLegVisual(leg,th,lift){
  const c=leg.cfg;
  leg.hip.rotation.z=th;
  const reach=(c.len-CFG.LIFT*lift)*Math.cos(th);
  const upper=c.len*0.51, lower=c.len*0.49;
  const cosK=THREE.MathUtils.clamp((reach-upper*Math.cos(th))/lower,0,1);
  const lowerAng=-Math.sign(th||1)*Math.acos(cosK);
  leg.knee.rotation.z=lowerAng-th;
}

/* ================================================================
   Records, leaderboard, achievements (localStorage)
================================================================ */
const store={
  get(k,d){ try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v;}catch(e){return d;} },
  set(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(e){} },
};
const ACH=[
  {id:'first',   ico:'🥇'},
  {id:'legend',  ico:'🏆'},
  {id:'race',    ico:'🐎'},
  {id:'clean',   ico:'✨'},
  {id:'sprint',  ico:'💨'},
  {id:'tumble',  ico:'🤕'},
  {id:'marathon',ico:'🏃'},
];
function unlock(id){
  const a=store.get('cc_ach',{});
  if(a[id])return false;
  a[id]=1; store.set('cc_ach',a);
  toast('🏆 '+tr('ach')[id]);
  return true;
}
let toastTimer=null;
function toast(msg){
  const el=$('toast');
  el.textContent=msg;
  el.classList.remove('hidden');
  el.style.opacity='0.95';
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.classList.add('hidden'),400);},2400);
}
function renderBoard(){
  const board=store.get('cc_board',[]);
  const list=$('boardList');
  list.innerHTML='';
  if(!board.length){
    list.innerHTML='<div class="boardEmpty">'+tr('board_empty')+'</div>';
  }else{
    board.forEach((r,i)=>{
      const row=document.createElement('div');
      row.className='boardRow';
      row.innerHTML='<span>'+(i+1)+'. '+r.n+'</span><b>'+r.t.toFixed(1)+'s · '+tr('ranks')[r.r]+'</b>';
      list.appendChild(row);
    });
  }
  const got=store.get('cc_ach',{});
  const grid=$('achGrid');
  grid.innerHTML='';
  for(const a of ACH){
    const cell=document.createElement('div');
    cell.className='achCell'+(got[a.id]?'':' locked');
    cell.innerHTML='<span class="ico">'+a.ico+'</span><span>'+tr('ach')[a.id]+'<br><small style="opacity:.6">'+tr('achDesc')[a.id]+'</small></span>';
    grid.appendChild(cell);
  }
}

/* ================================================================
   Game state
================================================================ */
const G = {
  state:'title',       // title | run | fallen | done
  x:0, vx:0, y:CFG.bodyY, vy:0,
  pitch:0, pitchV:0, roll:0, rollV:0, yaw:0, z:0,
  falls:0, steps:0, topSpeed:0, timeLeft:CFG.timeLimit,
  fallPose:null, simAcc:0,
  doneT:0, finishTime:0, dnf:false, resultShown:false, nPlant:4,
  lastBeepSec:99, countdown:0, lastCount:0,
  elapsed:0, practice:false,
  ghostOn:true, ghostData:null, rec:[], recAcc:0,
};
const held = {KeyQ:false,KeyW:false,KeyO:false,KeyP:false};
let animT=0, camShake=0;
const lookCur=new THREE.Vector3(2,1.4,0);
const camS={dist:8,x:0};   // chase-camera state (zoom + look-ahead)

function resetLegsNeutral(){
  for(const leg of legs){
    leg.th=0; leg.da=0; leg.lift=0; leg.on=true; leg.load=0.25;
    leg.footX=G.x+leg.cfg.x;
  }
}

function startRun(practice){
  sfx.ensure();
  G.state='run';
  G.practice=!!practice;
  G.x=0; G.vx=0; G.vy=0; G.y=CFG.bodyY;
  G.pitch=0; G.pitchV=0; G.roll=0; G.rollV=0; G.yaw=0; G.z=0;
  G.falls=0; G.steps=0; G.topSpeed=0; G.timeLeft=CFG.timeLimit;
  G.yaw=0; G.z=0; G.simAcc=0; G.fallPose=null;
  G.resultShown=false; G.lastBeepSec=99; G.dnf=false; G.doneT=0;
  G.countdown=3.0; G.lastCount=0;
  G.elapsed=0; G.rec=[]; G.recAcc=0;
  resetLegsNeutral();
  titleScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  boardScreen.classList.add('hidden');
  hudEl.classList.remove('hidden');
  keysBar.classList.remove('hidden');
  fallPromptEl.classList.add('hidden');
  goBanner.classList.add('hidden');
  countNumEl.textContent='3';
  countNumEl.classList.remove('hidden');
}

function toTitle(){
  G.state='title';
  G.x=0; G.vx=0; G.vy=0; G.y=CFG.bodyY; G.pitch=0; G.roll=0; G.yaw=0; G.z=0;
  G.fallPose=null; G.elapsed=0;
  resetLegsNeutral();
  hudEl.classList.add('hidden');
  keysBar.classList.add('hidden');
  fallPromptEl.classList.add('hidden');
  goBanner.classList.add('hidden');
  countNumEl.classList.add('hidden');
  resultScreen.classList.add('hidden');
  titleScreen.classList.remove('hidden');
}

function doFall(dir){
  if(G.state!=='run')return;
  G.state='fallen'; G.falls++;
  // hand over to the tumble simulation with the current momentum
  G.fallPose={
    roll:G.roll, wr:G.rollV, pitch:G.pitch, wp:G.pitchV,
    y:G.y+CFG.sag, t:0, landed:false, rise:0, from:null,
    yaw:0, z:0, vx:G.vx, w:0,
    legs:legs.map(l=>({th:l.th, lift:l.lift})),
  };
  sfx.fall(); camShake=0.5;
  dustAt(G.x,0,4); dustAt(G.x-0.6,0,2); dustAt(G.x+0.6,0,2);
  fallPromptEl.classList.add('hidden');
}

function tryGetUp(){
  const p=G.fallPose;
  if(G.state!=='fallen'||!p||!p.landed||p.rise>0)return;
  p.rise=1e-6;
  p.from={roll:p.roll,pitch:p.pitch,y:p.y,yaw:p.yaw,z:p.z};
  fallPromptEl.classList.add('hidden');
}

function finishRace(){
  G.state='done'; G.doneT=0; G.dnf=false;
  G.finishTime=G.elapsed;
  sfx.fanfare();
  burstConfetti(G.x,0);
  fallPromptEl.classList.add('hidden');
}
function timeUp(){
  G.state='done'; G.doneT=0; G.dnf=true;
  G.finishTime=CFG.timeLimit;
  sfx.buzz();
  fallPromptEl.classList.add('hidden');
}

const RANK_ICONS=['🏆','🥇','🐴','🍼'];
function rankIndex(){
  if(G.dnf)return 3;
  const t=G.finishTime;                  // rank is pure finish time, like the original
  return t<=22?0 : t<=32?1 : t<=50?2 : 3;
}
function showResult(){
  G.resultShown=true;
  const r=rankIndex();
  rankIcon.textContent=RANK_ICONS[r];
  rankText.textContent=I18N[lang].ranks[r];
  stTime.textContent=G.finishTime.toFixed(1);
  stFalls.textContent=G.falls;
  stSteps.textContent=G.steps;
  stSpeed.textContent=(G.topSpeed*3.6).toFixed(1)+' km/h';
  dnfBadge.classList.toggle('hidden',!G.dnf);
  newRecordEl.classList.add('hidden');
  nameRow.classList.add('hidden');
  achToastRow.innerHTML='';
  const ranked=!G.dnf&&!G.practice;

  if(ranked){
    // personal best
    const best=store.get('cc_best',null);
    if(!best||G.finishTime<best.t){
      store.set('cc_best',{t:G.finishTime});
      newRecordEl.classList.remove('hidden');
    }
    // save ghost of the best run
    const gb=store.get('cc_ghost',null);
    if(!gb||G.finishTime<gb.t){
      store.set('cc_ghost',{t:G.finishTime,pose:G.rec});
      G.ghostData={t:G.finishTime,pose:G.rec};
    }
    // achievements
    const won=[];
    if(unlock('first'))won.push('first');
    if(G.finishTime<=22&&unlock('legend'))won.push('legend');
    if(G.finishTime<=32&&unlock('race'))won.push('race');
    if(G.falls===0&&unlock('clean'))won.push('clean');
    for(const id of won){
      const b=document.createElement('div');
      b.className='achBadge';
      b.textContent=ACH.find(a=>a.id===id).ico+' '+tr('ach')[id];
      achToastRow.appendChild(b);
    }
    nameRow.classList.remove('hidden');
    nameInput.value=store.get('cc_name','');
  }

  // cumulative stats + achievements
  const stats=store.get('cc_stats',{runs:0,falls:0,dist:0});
  stats.runs+=1; stats.falls+=G.falls; stats.dist+=Math.round(G.x*10)/10;
  store.set('cc_stats',stats);
  if(stats.falls>=10)unlock('tumble');
  if(stats.dist>=500)unlock('marathon');

  hudEl.classList.add('hidden');
  keysBar.classList.add('hidden');
  fallPromptEl.classList.add('hidden');
  resultScreen.classList.remove('hidden');
}

/* ================================================================
   Physics — a faithful port of the original game's simulation
================================================================ */
function simStep(dt){
  const sinP=Math.sin(G.pitch), cosP=Math.cos(G.pitch);
  const sinR=Math.sin(G.roll),  cosR=Math.cos(G.roll);
  let thrust=0, brake=0, Fsum=0, pitchT=0, rollT=0, nOn=0, sideMask=0, legReact=0;

  for(const leg of legs){
    const c=leg.cfg;
    const keyHeld=!!held[c.key];

    // lift eases in/out; a lifted leg shortens, which is what actually lifts the hoof
    leg.lift+=((keyHeld?1:0)-leg.lift)*Math.min(1,CFG.LIFT_RATE*dt);

    const reach=(c.len-CFG.LIFT*leg.lift)*Math.cos(leg.th); // vertical leg reach
    const L=c.x-CFG.COM;                                    // hip x relative to COM
    const hipH=G.y+c.y+L*sinP-c.z*sinR;                     // hip height above ground
    const hipV=G.vy+L*cosP*G.pitchV-c.z*cosR*G.rollV;       // hip vertical velocity
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
      pitchT+=g*L*cosP;    // fore/aft hooves pitch the body
      rollT -=g*c.z*cosR;  // one-sided hooves roll the body away
      const b=Math.min(1.5,leg.load);
      if(keyHeld){
        brake+=CFG.SLIDE*b;                                  // holding a planted hoof makes it slide
      }else{
        thrust+=CFG.TRACTION*b*(-c.len*Math.cos(leg.th)*h);  // backswing kicks the ground
        brake+=CFG.TRACTION*b;
      }
      if(!wasOn){
        leg.footX=G.x+c.x+c.len*Math.sin(leg.th);
        G.steps++;
        sfx.clop(Math.min(1,Math.max(0,-hipV)/3));
        dustAt(leg.footX,c.z);
        printAt(leg.footX,c.z);
      }
    }
  }
  G.nPlant=nOn;

  /* ---- linear motion ---- */
  G.vx+=(thrust-brake*G.vx-CFG.DRAG*G.vx*Math.abs(G.vx))*dt;
  G.vy+=(Fsum-G_GRAV)*dt;
  G.y +=G.vy*dt;
  G.x +=G.vx*dt;

  /* ---- angular motion ---- */
  const net=thrust-brake*G.vx;
  pitchT+=CFG.REAR*net*G.y;                 // thrust pitches the nose up
  G.pitchV-=CFG.LEG_I*legReact/CFG.I_PITCH; // legs accelerating rocks the body
  G.pitchV+=(pitchT/CFG.I_PITCH+CFG.TIP_PITCH*sinP-CFG.ANG_DAMP*G.pitchV)*dt;
  const bal=sideMask===3?[0,0,CFG.BAL2,CFG.BALANCE,CFG.BAL4][nOn]:0;
  G.rollV+=(rollT/CFG.I_ROLL+CFG.TIP*sinR-bal*(G.roll+0.25*G.rollV)-CFG.ANG_DAMP*G.rollV)*dt;
  G.pitch+=G.pitchV*dt;
  G.roll +=G.rollV*dt;

  /* ---- falls ---- */
  if(Math.abs(G.roll)>CFG.FALL_ROLL)      doFall(G.roll>0?'left':'right');
  else if(Math.abs(G.pitch)>CFG.FALL_PITCH) doFall(G.pitch>0?'back':'nose');
  if(G.state!=='run')return;

  G.topSpeed=Math.max(G.topSpeed,G.vx);
  if(G.x>=CFG.finishX){ G.x=CFG.finishX; finishRace(); }
}

function updateFallen(dt){
  const p=G.fallPose;
  if(!p)return;

  // rising back to the feet over RISE_TIME, then resume normal simulation
  if(p.rise>0){
    p.rise=Math.min(1,p.rise+dt/CFG.RISE_TIME);
    if(p.rise>=1){
      G.state='run'; G.fallPose=null;
      G.roll=0; G.pitch=0; G.rollV=0; G.pitchV=0;
      G.vx=0; G.vy=0; G.y=CFG.bodyY; G.yaw=0; G.z=0;
      resetLegsNeutral();
      sfx.getup(); dustAt(G.x,0,2);
    }
    return;
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
    if(Math.abs(vel)>1.5&&Math.sign(vel)===Math.sign(ang))sfx.thud();
    return[Math.sign(ang)*limit,Math.sign(vel)===Math.sign(ang)?-vel*0.2:vel];
  };
  [p.roll,p.wr]=bounce(p.roll,p.wr,CFG.ROLL_REST);
  [p.pitch,p.wp]=bounce(p.pitch,p.wp,CFG.PITCH_REST);
  const ar=Math.abs(p.roll);
  p.y=Math.max(CFG.LIE_MIN,1.193*Math.cos(p.roll)*Math.cos(p.pitch)+0.17*Math.sin(ar));
  p.t+=dt;
  if(!p.landed&&(ar>=CFG.ROLL_REST*0.95||Math.abs(p.pitch)>=CFG.PITCH_REST*0.95||p.t>1.2)){
    p.landed=true;
    fallPromptEl.classList.remove('hidden');
  }

  // flail: the keys still paddle the legs while lying down, and once rolled over
  // fully, paddling drags the body along and spins it around — just like the original
  const u=Math.sign(p.roll), full=ar>1;
  for(let i=0;i<4;i++){
    const lp=p.legs[i], c=LEG_CFG[i];
    const heldNow=!!held[c.key];
    lp.lift+=((heldNow?1:0)-lp.lift)*Math.min(1,10*dt);
    const v=THREE.MathUtils.clamp(((heldNow?0.9:-0.4)-lp.th)/dt,-5,7);
    lp.th+=v*dt;
    if(full&&c.z*u>0&&lp.lift<0.5){
      p.vx-=v*0.45*dt;
      p.w+=v*(c.front?1:-1)*u*0.9*dt;
    }
  }
  p.vx*=Math.exp(-2.5*dt);
  p.w*=Math.exp(-2.5*dt);
  p.yaw+=p.w*dt;
  G.x+=p.vx*Math.cos(p.yaw)*dt;
  p.z=THREE.MathUtils.clamp(p.z-p.vx*Math.sin(p.yaw)*dt,-1.5,1.5);
  G.yaw=p.yaw; G.z=p.z;
}

function updateDone(dt){
  G.doneT+=dt;
  G.vx*=Math.max(0,1-2.5*dt);
  G.x+=G.vx*dt;
  if(!G.resultShown&&G.doneT>(G.dnf?0.9:1.3))showResult();
}

/* ================================================================
   Input
================================================================ */
function setHeld(code,v){
  if(!(code in held))return;
  held[code]=v;
  const el=$('key-'+code);
  if(el)el.classList.toggle('down',v);
}
function primaryAction(){
  if(G.state==='title')startRun();
  else if(G.state==='done'&&G.resultShown)startRun();
}
addEventListener('keydown',e=>{
  if(e.code==='Space'){ e.preventDefault(); if(!e.repeat)primaryAction(); return; }
  if(e.code==='Enter'){ if(!e.repeat)primaryAction(); return; }
  if(e.code==='KeyR'){ if(!e.repeat)tryGetUp(); return; }
  if(e.code==='KeyM'){ if(!e.repeat)toggleMute(); return; }
  if(e.code==='Escape'&&e.repeat===false){
    if(!boardScreen.classList.contains('hidden')){boardScreen.classList.add('hidden');return;}
    if(G.state!=='title')toTitle();
    return;
  }
  if(!e.repeat)setHeld(e.code,true);
});
addEventListener('keyup',e=>setHeld(e.code,false));
addEventListener('blur',()=>{ for(const k in held)setHeld(k,false); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden)for(const k in held)setHeld(k,false); });

for(const c of LEG_CFG){
  const el=$('key-'+c.key);
  el.addEventListener('pointerdown',e=>{e.preventDefault();sfx.ensure();setHeld(c.key,true);});
  el.addEventListener('pointerup',  ()=>setHeld(c.key,false));
  el.addEventListener('pointercancel',()=>setHeld(c.key,false));
  el.addEventListener('pointerleave',()=>setHeld(c.key,false));
  el.addEventListener('contextmenu',e=>e.preventDefault());
}

startBtn.addEventListener('click',()=>{startBtn.blur();startRun(false);});
practiceBtn.addEventListener('click',()=>{practiceBtn.blur();startRun(true);});
retryBtn.addEventListener('click',()=>{retryBtn.blur();startRun(false);});

boardBtn.addEventListener('click',()=>{boardBtn.blur();renderBoard();boardScreen.classList.remove('hidden');});
boardClose.addEventListener('click',()=>{boardClose.blur();boardScreen.classList.add('hidden');});

ghostBtn.addEventListener('click',()=>{
  ghostBtn.blur();
  G.ghostOn=!G.ghostOn;
  ghostBtn.style.opacity=G.ghostOn?'1':'0.4';
});
ghostBtn.style.opacity=G.ghostOn?'1':'0.4';

saveScoreBtn.addEventListener('click',()=>{
  const name=(nameInput.value.trim()||'馬主').slice(0,10);
  store.set('cc_name',name);
  const board=store.get('cc_board',[]);
  board.push({n:name,t:Math.round(G.finishTime*10)/10,r:rankIndex(),f:G.falls});
  board.sort((a,b)=>a.t-b.t);
  store.set('cc_board',board.slice(0,10));
  nameRow.classList.add('hidden');
  toast(tr('save_score')+' ✓');
});

shareBtn.addEventListener('click',async()=>{
  const r=I18N[lang].ranks[rankIndex()];
  const txt=lang==='zh'
    ? `達達馬蹄 Clip-Clop｜${G.dnf?'時間到':G.finishTime.toFixed(1)+'s 完賽 50m'}（${r}）跌倒 ${G.falls} 次 👐`
    : `Clip-Clop horse race｜${G.dnf?"time up":G.finishTime.toFixed(1)+'s for 50 m'} (${r}), ${G.falls} falls 👐`;
  try{
    if(navigator.share)await navigator.share({text:txt});
    else{await navigator.clipboard.writeText(txt);toast(tr('copied'));}
  }catch(e){
    try{await navigator.clipboard.writeText(txt);toast(tr('copied'));}catch(_){}
  }
});

function toggleMute(){
  sfx.muted=!sfx.muted;
  localStorage.setItem('cc_mute',sfx.muted?'1':'0');
  muteBtn.textContent=sfx.muted?'🔇':'🔊';
}
muteBtn.addEventListener('click',()=>{muteBtn.blur();sfx.ensure();toggleMute();});
muteBtn.textContent=sfx.muted?'🔇':'🔊';

langBtn.addEventListener('click',()=>{langBtn.blur();lang=lang==='zh'?'en':'zh';localStorage.setItem('cc_lang',lang);applyI18n();});
applyI18n();

/* ================================================================
   Visual sync & camera
================================================================ */
function syncVisuals(dt){
  const celebrate=G.state==='done'&&!G.dnf;

  // body pose: live sim state, or the tumble pose while fallen
  const p=G.fallPose;
  let by=G.y, bro=G.roll, byaw=G.yaw||0, bp=G.pitch, bz=G.z||0;
  if(p&&p.rise>0){
    const s=p.rise*p.rise*(3-2*p.rise), f=p.from, L=(a,b)=>a+(b-a)*s;
    by=L(f.y,CFG.bodyY); bro=L(f.roll,0); byaw=L(f.yaw,0); bp=L(f.pitch,0); bz=L(f.z,0);
  }else if(p){
    by=p.y; bro=p.roll; byaw=p.yaw; bp=p.pitch; bz=p.z;
  }
  by+=(celebrate?Math.abs(Math.sin(animT*7))*0.12:0);
  horseRoot.position.set(G.x,by-CFG.bodyY,bz);
  tilt.rotation.set(bro,byaw,bp);

  // legs: true IK sync (visual reach == physics reach); pressed keys light the band
  for(let i=0;i<4;i++){
    const leg=legs[i], src=p?p.legs[i]:leg;
    applyLegVisual(leg,src.th,src.lift);
    const pressed=!!held[leg.cfg.key]&&G.state!=='done';
    leg.band.material.emissive.setHex(pressed?leg.cfg.color:0x000000);
    leg.band.material.emissiveIntensity=pressed?0.55:0;
  }

  // neck bob
  const speedT=THREE.MathUtils.clamp(G.vx*0.12,0,0.4);
  if(neckRef)neckRef.rotation.z=-0.72+Math.sin(animT*1.7)*0.04-speedT;

  // segmented tail reacts to speed and vertical motion, like the original
  {
    const lift=-THREE.MathUtils.clamp(G.vx/5,0,1)*0.5;
    const sway=Math.sin(animT*(2.2+G.vx*1.2));
    for(let i=0;i<tailSegs.length;i++){
      const rest=i===0?-0.5:0;
      const amp=(i/tailSegs.length)*0.35+0.05;
      tailSegs[i].rotation.x=sway*amp*(1+G.vx*0.3)+G.vy*-0.06*(i+1)*0.25;
      tailSegs[i].rotation.z=rest+lift*(0.4+i*0.2);
    }
  }

  // ghost: replay the best run's recorded pose stream
  const gOn=G.ghostOn&&G.ghostData&&G.state!=='title'&&ghostParts;
  ghostRoot.visible=!!gOn;
  if(gOn){
    const frames=G.ghostData.pose;
    const fi=Math.min(frames.length-1,Math.floor(G.elapsed*30));
    const f=frames[fi];
    if(f){
      ghostRoot.position.set(f[0],f[1]-CFG.bodyY,f[5]);
      ghostTilt.rotation.set(f[2],f[4],f[3]);
      for(let i=0;i<4;i++)applyLegVisual(ghostParts.legs[i],f[6+i],f[10+i]);
    }
  }

  updateConfetti(dt);
  updateCrowd(dt, G.state!=='title'&&CFG.finishX-G.x<6&&G.x>40);

  // chase camera: distance auto-fits the horse to the screen and leads ahead by
  // speed, with a low 3/4 offset — the original game's framing
  const hFov=2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect);
  const fitW=camera.aspect<0.8?1.9:2.3;
  const dT=THREE.MathUtils.clamp(fitW/Math.tan(hFov/2),7.5,15);
  camS.dist+=(dT-camS.dist)*(1-Math.exp(-4*dt));
  camS.x+=(G.x+0.4+G.vx*0.25-camS.x)*(1-Math.exp(-5*dt));

  let px,py,pz,lx,ly,lz;
  if(G.state==='title'){
    const a=Math.sin(animT*0.12)*0.4;
    px=G.x-4.6+Math.sin(a)*1.5; py=2.6; pz=8-Math.cos(a)*1.2;
    lx=G.x+3.2; ly=1.3; lz=0;
  }else if(celebrate){
    const a=animT*0.3;
    px=G.x+Math.sin(a)*6.5; py=2.4; pz=Math.cos(a)*6.5;
    lx=G.x; ly=1.25; lz=0;
  }else{
    px=camS.x+camS.dist*0.28; py=1.7+camS.dist*0.08; pz=camS.dist;
    lx=camS.x; ly=0.95; lz=0;
  }
  if(camShake>0){
    camShake=Math.max(0,camShake-dt*1.4);
    px+=(Math.random()-0.5)*camShake*0.5;
    py+=(Math.random()-0.5)*camShake*0.5;
  }
  const kl=1-Math.exp(-4*dt);
  camera.position.lerp(new THREE.Vector3(px,py,pz),kl);
  lookCur.lerp(new THREE.Vector3(lx,ly,lz),kl);
  camera.lookAt(lookCur);

  // sun follows the horse so shadows stay crisp
  sun.position.set(G.x+3,8,6);
  sun.target.position.set(G.x,0,0);
  sun.target.updateMatrixWorld();

  for(const c of clouds){
    c.position.x+=dt*0.3;
    if(c.position.x>85)c.position.x=-15;
  }
  updateDust(dt);
}

/* ================================================================
   HUD & main loop
================================================================ */
function updateHud(){
  hudTime.textContent=G.elapsed.toFixed(1);
  hudDist.textContent=Math.max(0,CFG.finishX-G.x).toFixed(1)+' m';
  hudFalls.textContent=G.falls;
  hudEl.classList.toggle('warn',!G.practice&&G.timeLeft<10&&G.state!=='title');
}

const clock=new THREE.Clock();
function tick(dt,noRender){
  animT+=dt;
  G.frame=(G.frame||0)+1;

  if(G.state==='run'&&G.countdown>0){
    // 3-2-1 countdown: physics and clock are frozen, like the original
    G.countdown-=dt;
    const n=Math.max(0,Math.ceil(G.countdown));
    if(n>0&&n!==G.lastCount){
      G.lastCount=n;
      countNumEl.textContent=String(n);
      sfx.beep();
    }
    if(G.countdown<=0){
      countNumEl.classList.add('hidden');
      goBanner.classList.remove('hidden');
      goBanner.style.animation='none'; void goBanner.offsetWidth; goBanner.style.animation='';
      sfx.go();
    }
  }else{
    // fixed-step simulation at 240 Hz, like the original
    G.simAcc=(G.simAcc||0)+dt;
    let guard=0;
    while(G.simAcc>=CFG.STEP&&guard++<40){
      G.simAcc-=CFG.STEP;
      if(G.state==='run'||G.state==='fallen'){
        G.elapsed+=CFG.STEP;
        if(!G.practice){
          G.timeLeft-=CFG.STEP;
          const sec=Math.ceil(G.timeLeft);
          if(sec!==G.lastBeepSec&&sec<=5&&sec>0){G.lastBeepSec=sec;sfx.beep();}
          if(G.timeLeft<=0){G.timeLeft=0;timeUp();}
        }
      }
      if(G.state==='run')simStep(CFG.STEP);
      else if(G.state==='fallen')updateFallen(CFG.STEP);
      else break;
    }
    if(G.state==='done')updateDone(dt);

    // ghost recorder: sample the pose stream at 30 Hz
    if((G.state==='run'||G.state==='fallen')&&G.countdown<=0){
      G.recAcc+=dt;
      while(G.recAcc>=1/30){
        G.recAcc-=1/30;
        const fp=G.fallPose;
        const frame=[
          G.x, fp?fp.y:G.y, fp?fp.roll:G.roll, fp?fp.pitch:G.pitch,
          fp?fp.yaw:G.yaw, fp?fp.z:G.z,
        ];
        for(let i=0;i<4;i++){const L=fp?fp.legs[i]:legs[i];frame.push(L.th,L.lift);}
        G.rec.push(frame.map(v=>Math.round(v*1000)/1000));
      }
    }
    // tip warning, like the original
    const warnOn=G.state==='run'&&G.countdown<=0&&(Math.abs(G.roll)>0.32||Math.abs(G.pitch)>0.4);
    tipWarnEl.classList.toggle('hidden',!warnOn);
    if(!G.practice&&G.state==='run'&&G.topSpeed>=2.5)unlock('sprint');
  }
  updateHud();
  syncVisuals(dt);
  if(!noRender)renderer.render(scene,camera);
}
function loop(){
  requestAnimationFrame(loop);
  if(window.__manual)return;   // test harness drives ticks itself
  tick(Math.min(clock.getDelta(),0.033));
}

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

/* ================================================================
   Boot
================================================================ */
buildWorld();
buildClouds();
buildHorse();
buildGhost();
buildDust();
buildHoofprints();
buildConfetti();
buildCrowd();
G.ghostData=store.get('cc_ghost',null);
if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
window.__ready=true;
window.__game=G;       // debug/testing hook
window.__legs=legs;
window.__CFG=CFG;
window.__tick=tick;    // manual frame pump for automated tests (rAF may be throttled in embedded browsers)
window.__errs=[];
addEventListener('error',e=>window.__errs.push(e.message+' @'+(e.filename||'')+':'+e.lineno));
addEventListener('unhandledrejection',e=>window.__errs.push('rejection: '+e.reason));
loadingEl.remove();
loop();
