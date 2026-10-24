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
    ai_solo:'獨跑', ai_pony:'小馬', ai_race:'賽馬', ai_legend:'傳奇',
    opp:'對手', opp_win:'你贏了！', opp_lose:'對手較快…', opp_dnf:'對手未完賽',
    duel:'雙人對戰', duel_next:'換 2P 上場 →', duel_again:'再來一戰！',
    duel_p1win:'1P 獲勝！', duel_p2win:'2P 獲勝！', duel_draw:'平手！',
    replay_skip:'▶ 略過（Space）',
    share_title:'SHARE · 分享戰報',
    share_native:'系統分享（含圖卡）', share_copy:'複製戰報', share_download:'下載圖卡',
    share_x:'分享到 X', share_line:'分享到 LINE',
    tour:'錦標賽', next_battle:'下一戰：', pts:'積分',
    champ9:'🏆 冠軍！', champ6:'🥈 亞軍', champ3:'🥉 季軍', champ0:'再接再厲！',
    leg_win:'勝', leg_lose:'負',
    code:'戰報碼', code_copy:'複製', code_import:'輸入戰報碼', code_load:'載入挑戰幽靈',
    code_clear:'清除挑戰幽靈', code_loaded:'已載入挑戰幽靈', code_invalid:'戰報碼無效或已損毀',
    code_ph:'貼上 CC1. 開頭的戰報碼…',
    perf_hi:'畫質：高', perf_mid:'畫質：中', perf_lo:'畫質：省電', perf_auto:'畫質：自動',
    perf_auto_drop:'偵測到低幀率，已自動調降畫質',
    lb_local:'本地', lb_world:'世界', lb_refresh:'重新整理',
    lb_upload:'上傳世界排行', lb_uploaded:'已上傳世界排行 ✓', lb_upload_fail:'上傳失敗，稍後再試',
    lb_rate:'太快了，一分鐘後再上傳', lb_need_name:'請先輸入名字',
    lb_not_configured:'世界排行尚未設定（需 Supabase）', lb_empty:'還沒有任何世界紀錄，去跑一場吧！',
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
    ai_solo:'Solo', ai_pony:'Pony', ai_race:'Racehorse', ai_legend:'Legend',
    opp:'OPP', opp_win:'You win!', opp_lose:'Opponent was faster…', opp_dnf:'Opponent did not finish',
    duel:'2P Duel', duel_next:"Player 2's turn →", duel_again:'Rematch!',
    duel_p1win:'Player 1 wins!', duel_p2win:'Player 2 wins!', duel_draw:'Draw!',
    replay_skip:'▶ Skip (Space)',
    share_title:'SHARE YOUR RUN',
    share_native:'Share (with card)', share_copy:'Copy result', share_download:'Download card',
    share_x:'Share to X', share_line:'Share to LINE',
    tour:'Championship', next_battle:'Next: ', pts:'PTS',
    champ9:'🏆 Champion!', champ6:'🥈 Runner-up', champ3:'🥉 Third', champ0:'Keep trying!',
    leg_win:'WIN', leg_lose:'LOSS',
    code:'Battle code', code_copy:'Copy', code_import:'Enter battle code', code_load:'Load rival ghost',
    code_clear:'Clear rival ghost', code_loaded:'Rival ghost loaded', code_invalid:'Invalid or corrupted code',
    code_ph:'Paste a code starting with CC1.…',
    perf_hi:'Quality: High', perf_mid:'Quality: Medium', perf_lo:'Quality: Battery', perf_auto:'Quality: Auto',
    perf_auto_drop:'Low framerate — quality lowered automatically',
    lb_local:'Local', lb_world:'World', lb_refresh:'Refresh',
    lb_upload:'Upload to world board', lb_uploaded:'Uploaded ✓', lb_upload_fail:'Upload failed, try later',
    lb_rate:'Too fast — wait a minute between uploads', lb_need_name:'Enter a name first',
    lb_not_configured:'World board not configured (needs Supabase)', lb_empty:'No world records yet — go run one!',
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
      fallsPill=$('fallsPill'), aiPill=$('aiPill'), hudAi=$('hudAi'),
      langBtn=$('langBtn'), muteBtn=$('muteBtn'), ghostBtn=$('ghostBtn'),
      fallPromptEl=$('fallPrompt'), goBanner=$('goBanner'), countNumEl=$('countNum'), keysBar=$('keysBar'),
      tipWarnEl=$('tipWarn'), lbTop=$('lbTop'), lbBot=$('lbBot'),
      titleScreen=$('titleScreen'), startBtn=$('startBtn'), practiceBtn=$('practiceBtn'), duelBtn=$('duelBtn'),
      boardBtn=$('boardBtn'), boardScreen=$('boardScreen'), boardClose=$('boardClose'),
      perfBtn=$('perfBtn'), tourBtn=$('tourBtn'), codeImportBtn=$('codeImportBtn'),
      codeRow=$('codeRow'), codeInput=$('codeInput'), codeCopyBtn=$('codeCopyBtn'),
      codeScreen=$('codeScreen'), codeArea=$('codeArea'), codeLoadBtn=$('codeLoadBtn'),
      codeClearBtn=$('codeClearBtn'), codeCloseBtn=$('codeCloseBtn'), codeHint=$('codeHint'),
      shareScreen=$('shareScreen'), shareImg=$('shareImg'), shareClose=$('shareClose'),
      shareCopy=$('shareCopy'), shareDl=$('shareDl'), shareNative=$('shareNative'),
      shareX=$('shareX'), shareLine=$('shareLine'),
      resultScreen=$('resultScreen'), dnfBadge=$('dnfBadge'), newRecordEl=$('newRecord'),
      oppRow=$('oppRow'), duelRow=$('duelRow'),
      nameRow=$('nameRow'), nameInput=$('nameInput'), saveScoreBtn=$('saveScoreBtn'),
      achToastRow=$('achToastRow'), shareBtn=$('shareBtn'),
      uploadRow=$('uploadRow'), uploadBtn=$('uploadBtn'), worldList=$('worldList'),
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

// Builds a complete horse. opts.ghost renders a translucent shadow-free copy
// (best-run replay); opts.coat picks the body color (AI horses are chestnut).
function buildHorseMesh(root, tiltG, opts){
  const ghost=!!(opts&&opts.ghost);
  const coat=(opts&&opts.coat)||0xdedad0;
  const legCoat=new THREE.Color(coat).multiplyScalar(0.92);
  const M=(color,rough)=>ghost
    ? new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:0.28,roughness:.8,depthWrite:false})
    : new THREE.MeshStandardMaterial({color,roughness:rough});
  const bodyMat  = M(coat,.85);
  const legMat   = M(legCoat.getHex(),.85);
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
  horseParts=buildHorseMesh(horseRoot,tilt,{coat:0xdedad0});
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
  ghostParts=buildHorseMesh(ghostRoot,ghostTilt,{ghost:true});
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
   AI opponent — a real horse on the same physics, driven by a
   rhythm engine with per-level cadence and jitter (and the pony
   occasionally over-holds a pair and tumbles).
================================================================ */
const AI_LEVELS={
  pony:  {hold:7, gap:4, jit:2, stumble:28},
  race:  {hold:6, gap:3, jit:2, stumble:0},
  legend:{hold:6, gap:2, jit:1, stumble:0},
};
const AI_LANES={pony:-1.15, race:-1.15, legend:-1.15};
const aiRoot=new THREE.Group();
const aiTilt=new THREE.Group();
aiTilt.position.y=CFG.bodyY;
aiRoot.add(aiTilt);
aiRoot.visible=false;
scene.add(aiRoot);
let aiParts=null;
function buildAIHorse(){
  aiParts=buildHorseMesh(aiRoot,aiTilt,{coat:0xb3855f});
}
const AI_NOINPUT=[0,0,0,0,0];
const AI={S:null,L:null,level:null,acc:0,phase:0,t:0,cycle:0,inp:AI_NOINPUT,finishTime:null,getupAt:0};

function aiStart(level){
  AI.level=level||null;
  if(!AI.level){aiRoot.visible=false;return;}
  AI.S=makeHorseState();
  AI.L=makeLegStates();
  AI.acc=0; AI.phase=0; AI.t=0; AI.cycle=0;
  AI.inp=AI_NOINPUT.slice();
  AI.finishTime=null; AI.getupAt=0;
  aiRoot.visible=true;
}

// Frame-level cadence scheduler; phases: 0 hold O+W, 1 gap, 2 hold P+Q, 3 gap.
function aiDrive(dt){
  const cfg=AI_LEVELS[AI.level];
  if(!cfg)return;
  // while tumbling, stop the rhythm (paddling would drag the body around)
  // and just ask to get up once the pose has settled
  if(!AI.S.fallPose){
    AI.acc+=dt;
    while(AI.acc>=1/60){
      AI.acc-=1/60;
      AI.t--;
      if(AI.t<=0){
        AI.phase=(AI.phase+1)%4;
        AI.cycle++;
        const holding=AI.phase===0||AI.phase===2;
        let dur=Math.max(1,(holding?cfg.hold:cfg.gap)+(cfg.jit?Math.round((Math.random()*2-1)*cfg.jit):0));
        if(holding&&cfg.stumble&&AI.cycle%cfg.stumble===0)dur=26;   // over-hold -> tumble
        AI.t=dur;
        AI.inp=AI_NOINPUT.slice();
        if(holding){
          if(AI.phase===0){AI.inp[2]=1;AI.inp[1]=1;}   // O + W
          else{AI.inp[3]=1;AI.inp[0]=1;}               // P + Q
        }
      }
    }
  }else{
    AI.inp=AI_NOINPUT.slice();
  }
  const p=AI.S.fallPose;
  AI.inp[4]=0;
  if(p&&p.landed&&!p.rise){
    AI.getupAt+=dt;
    if(AI.getupAt>0.7){AI.inp[4]=1;AI.getupAt=0;}
  }else{
    AI.getupAt=0;
  }
}

function aiTick(dt){
  if(!AI.level||!AI.S)return;
  const inp=AI.finishTime!=null?AI_NOINPUT:AI.inp;
  simHorse(AI.S,AI.L,inp,dt);
  if(AI.finishTime==null&&AI.S.x>=CFG.finishX)AI.finishTime=G.elapsed;
}

/* ================================================================
   Finish replay — the recorder's pose stream played back slowly
   with a low side dolly camera and letterbox bars.
================================================================ */
function startReplay(){
  if(G.dnf||G.rec.length<90)return false;
  G.replay={active:true,t:0,frames:G.rec.slice(-105)};   // last ~3.5 s
  lbTop.classList.remove('hidden');
  lbBot.classList.remove('hidden');
  return true;
}
function endReplay(){
  if(!G.replay)return;
  G.replay.active=false;
  G.doneT=0.9;   // result follows almost immediately
  lbTop.classList.add('hidden');
  lbBot.classList.add('hidden');
}

/* ================================================================
   Local 2-player duel — alternating timed runs, winner compared.
================================================================ */
const DUEL={on:false,turn:0,t1:0,t2:0};
function duelStart(){
  DUEL.on=true; DUEL.turn=1; DUEL.t1=0; DUEL.t2=0;
  TOUR.on=false;
  aiSel='';                       // no AI in duels
  refreshAiChips();
  startRun(false);
}
function duelRecord(t){
  if(DUEL.turn===1)DUEL.t1=t; else DUEL.t2=t;
}

/* ================================================================
   Championship — three legs against pony → racehorse → legend.
================================================================ */
const TOUR_AI=['pony','race','legend'];
const TOUR={on:false,leg:0,pts:0,marks:''};
function tourStart(){
  TOUR.on=true; TOUR.leg=1; TOUR.pts=0; TOUR.marks='';
  DUEL.on=false;
  startRun(false);
}
function tourLegResult(){
  const win=!G.dnf&&(AI.finishTime==null||G.finishTime<=AI.finishTime);
  TOUR.pts+=win?3:0;
  TOUR.marks+=win?'勝':'負';
  return win;
}

/* ================================================================
   Haptics — best-effort vibration (no-op where unsupported).
================================================================ */
function buzz(p){
  try{navigator.vibrate&&navigator.vibrate(p);}catch(e){}
}

/* ================================================================
   Performance guard — auto-degrades render quality when the
   device can't hold the frame budget; manual override in corner.
================================================================ */
const PERF={mode:null,lvl:null,frames:0,secs:0,low:0};
function perfInit(){   // lazy: `store` is defined further down the module
  PERF.mode=store.get('cc_perf','auto');
  PERF.lvl=store.get('cc_perf_lvl',0);
  applyPerfLevel(PERF.lvl);
  refreshPerfBtn();
}
function applyPerfLevel(lvl){
  PERF.lvl=lvl;
  store.set('cc_perf_lvl',lvl);
  renderer.setPixelRatio(lvl===0?Math.min(devicePixelRatio,2):1);
  if(lvl<=1){
    sun.castShadow=true;
    const size=lvl===0?2048:1024;
    if(sun.shadow.mapSize.x!==size){
      sun.shadow.mapSize.set(size,size);
      if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}
    }
  }else{
    sun.castShadow=false;
  }
}
function perfTick(dt){
  PERF.frames++; PERF.secs+=dt;
  if(PERF.secs>=1){
    const fps=PERF.frames/PERF.secs;
    PERF.frames=0; PERF.secs=0;
    if(PERF.mode==='auto'&&(G.state==='run'||G.state==='fallen')){
      if(fps<45)PERF.low++; else PERF.low=0;
      if(PERF.low>=3&&PERF.lvl<2){
        applyPerfLevel(PERF.lvl+1);
        PERF.low=0;
        toast('⚡ '+tr('perf_auto_drop'));
      }
    }
  }
}

/* ================================================================
   Battle code — a paste-friendly record of a solo run: stats plus a
   10 Hz position trace (deflate + base64url). Importing it loads a
   challenge ghost to race against.
================================================================ */
const b64u={
  enc:b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
  dec:s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)),
};
async function deflateText(str){
  if(!window.CompressionStream)return null;
  const cs=new CompressionStream('deflate-raw');
  const w=cs.writable.getWriter();
  w.write(new TextEncoder().encode(str));
  w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
async function inflateText(bytes){
  if(!window.DecompressionStream)throw new Error('no-inflate');
  const ds=new DecompressionStream('deflate-raw');
  const w=ds.writable.getWriter();
  w.write(bytes);
  w.close();
  return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer());
}
async function makeBattleCode(){
  const xs=[];
  for(let i=0;i<G.rec.length;i+=3)xs.push(Math.round(G.rec[i][0]*10));   // 10 Hz, 0.1 m units
  const payload={v:1,t:Math.round(G.finishTime*10),f:G.falls,s:G.steps,
                 sp:Math.round(G.topSpeed*36),x:xs};
  const json=JSON.stringify(payload);
  const def=await deflateText(json);
  return def?('CC1.'+b64u.enc(def)):('CC0.'+b64u.enc(new TextEncoder().encode(json)));
}
async function parseBattleCode(raw){
  const code=(raw||'').replace(/\s+/g,'');
  const m=/^CC([01])\.([A-Za-z0-9_-]+)$/.exec(code);
  if(!m)throw new Error('bad');
  const bytes=b64u.dec(m[2]);
  const json=m[1]==='1'?await inflateText(bytes):new TextDecoder().decode(bytes);
  const p=JSON.parse(json);
  if(!p||p.v!==1||!(p.x instanceof Array)||p.x.length<10)throw new Error('bad');
  return p;
}
// Rebuild a 30 Hz ghost pose stream from the 10 Hz trace, with a
// synthesized trot so the challenge ghost visibly runs.
function rivalPoseFrom(p){
  const frames=[];
  const n=p.x.length;
  let ph=0;
  for(let i=0;i<n*3;i++){
    const t10=i/3;
    const k=Math.floor(t10);
    const a=p.x[Math.max(0,Math.min(n-1,k-1))], b=p.x[Math.max(0,Math.min(n-1,k))];
    const c=p.x[Math.max(0,Math.min(n-1,k+1))];
    const x=((b-a)+(c-a)*(t10-k))*0.05+a*0.1;   // smooth-ish interp in metres
    const sp=Math.max(0,b-a);                    // 1 unit delta ≈ 1 m/s
    ph+=sp*5.0/30;
    const A=0.35*Math.min(1,sp/1.2);
    const s1=Math.sin(ph), s2=Math.sin(ph+Math.PI);
    const lift=q=>Math.max(0,Math.min(1,q*1.3));
    const y=CFG.bodyY+0.03*Math.sin(ph*2);
    frames.push([Math.round(x*1000)/1000,Math.round(y*1000)/1000,0,0,0,0,
      s1*A,-s2*A,-s2*A,s1*A,
      lift(s1*A),lift(-s2*A),lift(-s2*A),lift(s1*A)]);
  }
  return frames;
}
async function loadRivalCode(code){
  const p=await parseBattleCode(code);
  const pose=rivalPoseFrom(p);
  store.set('cc_rival',{t:p.t,f:p.f,pose});
  G.ghostData={t:p.t/10,pose};
  toast(tr('code_loaded')+' '+(p.t/10).toFixed(1)+'s 🐎');
}

/* ================================================================
   Online leaderboard (Supabase REST, append-only via RLS).
   Configure in leaderboard-config.js; UI hides itself until set up.
================================================================ */
const LB={
  get cfg(){return window.CC_LEADERBOARD||null;},
  ok(){const c=this.cfg;return !!(c&&c.url&&c.key&&c.url.indexOf('YOUR')<0&&c.key.indexOf('YOUR')<0);},
  cache:null,lastFetch:0,
  async top(force){
    if(!this.ok())return null;
    if(!force&&this.cache&&Date.now()-this.lastFetch<60000)return this.cache;
    const r=await fetch(this.cfg.url+'/rest/v1/clipclop_scores?select=name,time_ms,falls,code,created_at&order=time_ms.asc&limit=20',{
      headers:{apikey:this.cfg.key,Authorization:'Bearer '+this.cfg.key},
    });
    if(!r.ok)throw new Error('lb fetch '+r.status);
    this.cache=await r.json();
    this.lastFetch=Date.now();
    return this.cache;
  },
  async submit(row){
    const r=await fetch(this.cfg.url+'/rest/v1/clipclop_scores',{
      method:'POST',
      headers:{apikey:this.cfg.key,Authorization:'Bearer '+this.cfg.key,
               'Content-Type':'application/json',Prefer:'return=minimal'},
      body:JSON.stringify(row),
    });
    if(!r.ok&&r.status!==201)throw new Error('lb post '+r.status);
  },
};
function renderWorld(rows){
  const list=$('worldList');
  list.innerHTML='';
  if(!LB.ok()){
    list.innerHTML='<div class="boardEmpty">'+tr('lb_not_configured')+'</div>';
    return;
  }
  if(!rows||!rows.length){
    list.innerHTML='<div class="boardEmpty">'+tr('lb_empty')+'</div>';
    return;
  }
  rows.forEach((r,i)=>{
    const row=document.createElement('div');
    row.className='boardRow';
    const d=new Date(r.created_at);
    const date=(d.getMonth()+1)+'/'+d.getDate();
    const left=document.createElement('span');
    left.textContent=(i+1)+'. '+r.name+'　'+(r.time_ms/1000).toFixed(1)+'s · '+r.falls+'♪ · '+date;
    const btn=document.createElement('button');
    btn.className='rowGhost';
    btn.textContent='🐎';
    btn.title=tr('code_load');
    btn.addEventListener('click',async()=>{
      try{await loadRivalCode(r.code);}catch(e){toast(tr('code_invalid'));}
    });
    row.appendChild(left);
    row.appendChild(btn);
    list.appendChild(row);
  });
}
async function refreshWorld(force){
  if(!LB.ok()){renderWorld(null);return;}
  try{
    renderWorld(await LB.top(force));
  }catch(e){
    renderWorld(null);
    $('worldList').innerHTML='<div class="boardEmpty">'+tr('lb_upload_fail')+'</div>';
  }
}
document.querySelectorAll('#lbTabs [data-lb]').forEach(b=>{
  b.addEventListener('click',()=>{
    b.blur();
    document.querySelectorAll('#lbTabs [data-lb]').forEach(x=>x.classList.toggle('sel',x===b));
    const world=b.dataset.lb==='world';
    $('boardList').classList.toggle('hidden',world);
    $('worldList').classList.toggle('hidden',!world);
    if(world)refreshWorld(false);
  });
});
$('lbRefresh').addEventListener('click',()=>{$('lbRefresh').blur();refreshWorld(true);});

uploadBtn.addEventListener('click',async()=>{
  if(!LB.ok())return;
  const name=(nameInput.value.trim()||store.get('cc_name','')).slice(0,10);
  if(!name){nameInput.focus();toast(tr('lb_need_name'));return;}
  const now=Date.now(),last=store.get('cc_last_upload',0);
  if(now-last<60000){toast(tr('lb_rate'));return;}
  let p;
  try{p=await parseBattleCode(codeInput.value);}
  catch(e){toast(tr('code_invalid'));return;}
  // integrity: the code must encode this run's time and reach the line
  if(Math.abs(p.t-Math.round(G.finishTime*10))>2||p.x[p.x.length-1]<480){
    toast(tr('code_invalid'));
    return;
  }
  try{
    await LB.submit({
      name,
      time_ms:Math.round(G.finishTime*1000),
      falls:G.falls,
      steps:G.steps,
      speed:Math.round(G.topSpeed*36),
      code:codeInput.value,
    });
    store.set('cc_last_upload',now);
    LB.lastFetch=0;
    toast(tr('lb_uploaded'));
  }catch(e){
    toast(tr('lb_upload_fail'));
  }
});

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
  elapsed:0, practice:false, replay:null,
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
  G.replay=null;
  lbTop.classList.add('hidden');
  lbBot.classList.add('hidden');
  aiStart(DUEL.on||TOUR.on ? (TOUR.on?TOUR_AI[TOUR.leg-1]:null) : aiSel);
  const rv=store.get('cc_rival',null);
  G.ghostData=rv?{t:rv.t/10,pose:rv.pose}:store.get('cc_ghost',null);
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
  G.fallPose=null; G.elapsed=0; G.replay=null;
  DUEL.on=false;
  TOUR.on=false; TOUR.leg=0; TOUR.pts=0; TOUR.marks='';
  codeScreen.classList.add('hidden');
  codeRow.classList.add('hidden');
  aiStart(null);
  lbTop.classList.add('hidden');
  lbBot.classList.add('hidden');
  aiPill.classList.add('hidden');
  resetLegsNeutral();
  applyI18n();   // resets duel-specific button labels
  hudEl.classList.add('hidden');
  keysBar.classList.add('hidden');
  fallPromptEl.classList.add('hidden');
  goBanner.classList.add('hidden');
  countNumEl.classList.add('hidden');
  resultScreen.classList.add('hidden');
  titleScreen.classList.remove('hidden');
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
  if(DUEL.on)duelRecord(G.finishTime);
  sfx.fanfare();
  buzz([60,50,60,50,180]);
  burstConfetti(G.x,0);
  fallPromptEl.classList.add('hidden');
  if(!startReplay())G.doneT=0.9;   // no replay (short/DNF) -> result comes sooner
}
function timeUp(){
  G.state='done'; G.doneT=0; G.dnf=true;
  G.finishTime=CFG.timeLimit;
  if(DUEL.on)duelRecord(G.finishTime);
  sfx.buzz();
  buzz(300);
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
  oppRow.classList.add('hidden');
  duelRow.classList.add('hidden');
  codeRow.classList.add('hidden');
  uploadRow.classList.add('hidden');
  const ranked=!G.dnf&&!G.practice&&!DUEL.on&&!TOUR.on;

  if(TOUR.on){
    // championship: leg results, running points, final trophy
    const win=tourLegResult();
    if(TOUR.leg<3){
      rankIcon.textContent=win?'🏅':'💪';
      rankText.textContent=tr('pts')+' '+TOUR.pts+'/9 · '+TOUR.marks;
      duelRow.textContent=tr('leg_'+(win?'win':'lose'))+'　·　'+tr('next_battle')+tr('ai_'+TOUR_AI[TOUR.leg]);
      duelRow.classList.remove('hidden');
      retryBtn.textContent=tr('next_battle')+tr('ai_'+TOUR_AI[TOUR.leg])+' →';
    }else{
      const cup=TOUR.pts>=9?'champ9':TOUR.pts>=6?'champ6':TOUR.pts>=3?'champ3':'champ0';
      rankIcon.textContent=TOUR.pts>=9?'🏆':TOUR.pts>=6?'🥈':TOUR.pts>=3?'🥉':'🐎';
      rankText.textContent=tr(cup);
      duelRow.textContent=TOUR.marks+'　·　'+tr('pts')+' '+TOUR.pts+'/9';
      duelRow.classList.remove('hidden');
      retryBtn.textContent=tr('duel_again');
    }
  }else if(DUEL.on){
    // alternating duel: turn 1 hands over, turn 2 shows the winner
    if(DUEL.turn===1){
      rankIcon.textContent='1️⃣';
      rankText.textContent='1P：'+G.finishTime.toFixed(1)+' s';
      retryBtn.textContent=tr('duel_next');
    }else{
      const t1=DUEL.t1,t2=DUEL.t2;
      rankIcon.textContent=t1<t2?'1️⃣':(t2<t1?'2️⃣':'🤝');
      rankText.textContent=t1<t2?tr('duel_p1win'):(t2<t1?tr('duel_p2win'):tr('duel_draw'));
      duelRow.textContent='1P '+t1.toFixed(1)+' s　｜　2P '+t2.toFixed(1)+' s';
      duelRow.classList.remove('hidden');
      retryBtn.textContent=tr('duel_again');
    }
  }else{
    retryBtn.textContent=tr('retry');
    if(AI.level){
      const at=AI.finishTime;
      let msg;
      if(G.dnf)msg=at!=null?tr('opp_lose'):tr('opp_dnf');
      else if(at==null)msg=tr('opp_win');
      else msg=G.finishTime<=at?tr('opp_win'):tr('opp_lose');
      oppRow.textContent=tr('opp')+'（'+tr('ai_'+AI.level)+'）：'+(at!=null?at.toFixed(1)+' s':'—')+'　·　'+msg;
      oppRow.classList.remove('hidden');
    }
  }

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
    // battle code for this run (paste-friendly, carries a 10 Hz trace)
    makeBattleCode().then(code=>{
      if(G.state!=='done'||G.dnf)return;
      codeInput.value=code;
      codeRow.classList.remove('hidden');
    }).catch(()=>{});
    if(LB.ok())uploadRow.classList.remove('hidden');
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
  aiPill.classList.add('hidden');
  resultScreen.classList.remove('hidden');
}

/* ================================================================
   Physics — a faithful port of the original game's simulation.
   Parameterized so the same code drives the player's horse and the
   AI opponents: simHorse(S, L, inp, dt) is pure except for S/L and
   returns events for the game layer (sound, dust, UI).
================================================================ */
function makeLegStates(){
  return LEG_CFG.map(c=>({cfg:c,th:0,da:0,lift:0,on:true,load:0.25,footX:c.x}));
}
function makeHorseState(){
  return {x:0,vx:0,y:CFG.bodyY,vy:0,pitch:0,pitchV:0,roll:0,rollV:0,yaw:0,z:0,
          steps:0,topSpeed:0,fallPose:null};
}
function standUpLegs(S,L){
  for(const l of L){l.th=0;l.da=0;l.lift=0;l.on=true;l.load=0.25;l.footX=S.x+l.cfg.x;}
}

// One physics substep. inp = [Q, W, O, P, getup].
function simHorse(S,L,inp,dt){
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
  S.vx+=(thrust-brake*S.vx-CFG.DRAG*S.vx*Math.abs(S.vx))*dt;
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
  S.x+=p.vx*Math.cos(p.yaw)*dt;
  p.z=THREE.MathUtils.clamp(p.z-p.vx*Math.sin(p.yaw)*dt,-1.5,1.5);
  S.yaw=p.yaw; S.z=p.z;

  // get-up request (player: R key path; AI: driver raises inp[4] once landed)
  if(inp[4]&&p.landed&&!p.rise){
    p.rise=1e-6;
    p.from={roll:p.roll,pitch:p.pitch,y:p.y,yaw:p.yaw,z:p.z};
    ev.push({type:'getup'});
  }
  return ev;
}

// Player-side adapter: wires the shared simulation to sound/dust/UI and race rules.
function simStep(dt){
  const inp=[held.KeyQ,held.KeyW,held.KeyO,held.KeyP,false];
  const ev=simHorse(G,legs,inp,dt);
  for(const e of ev){
    if(e.type==='step'){
      sfx.clop(e.speed);
      dustAt(e.footX,e.z);
      printAt(e.footX,e.z);
    }else if(e.type==='fall'){
      G.state='fallen'; G.falls++;
      sfx.fall(); camShake=0.5;
      buzz([90,50,140]);
      dustAt(G.x,0,4); dustAt(G.x-0.6,0,2); dustAt(G.x+0.6,0,2);
      fallPromptEl.classList.add('hidden');
    }else if(e.type==='thud'){
      sfx.thud();
      buzz(50);
    }else if(e.type==='landed'){
      fallPromptEl.classList.remove('hidden');
    }else if(e.type==='up'){
      G.state='run';
      sfx.getup(); dustAt(G.x,0,2);
    }
  }
  if(G.state==='run'&&!G.fallPose&&G.x>=CFG.finishX){ G.x=CFG.finishX; finishRace(); }
}

function updateDone(dt){
  if(G.replay&&G.replay.active){
    G.replay.t+=dt*0.5;                    // slow motion
    if(G.replay.t>=3.5)endReplay();
    return;
  }
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
  if(G.state==='title'){startRun(false);return;}
  if(G.state==='done'&&G.resultShown){
    if(TOUR.on&&TOUR.leg<3){TOUR.leg++;startRun(false);}
    else if(TOUR.on)tourStart();
    else if(DUEL.on&&DUEL.turn===1){DUEL.turn=2;startRun(false);}
    else if(DUEL.on)duelStart();
    else startRun(false);
  }
}
addEventListener('keydown',e=>{
  if(e.code==='Space'){
    e.preventDefault();
    if(e.repeat)return;
    if(G.replay&&G.replay.active)endReplay();   // skip the finish replay
    else primaryAction();
    return;
  }
  if(e.code==='Enter'){ if(!e.repeat)primaryAction(); return; }
  if(e.code==='KeyR'){ if(!e.repeat)tryGetUp(); return; }
  if(e.code==='KeyM'){ if(!e.repeat)toggleMute(); return; }
  if(e.code==='Escape'&&e.repeat===false){
    if(!codeScreen.classList.contains('hidden')){codeScreen.classList.add('hidden');return;}
    if(!shareScreen.classList.contains('hidden')){shareScreen.classList.add('hidden');return;}
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
retryBtn.addEventListener('click',()=>{
  retryBtn.blur();
  if(TOUR.on&&TOUR.leg<3){TOUR.leg++;startRun(false);}
  else if(TOUR.on)tourStart();
  else if(DUEL.on&&DUEL.turn===1){DUEL.turn=2;startRun(false);}
  else if(DUEL.on)duelStart();
  else startRun(false);
});

// AI opponent level chips + duel entry on the title card
let aiSel='';
function refreshAiChips(){
  document.querySelectorAll('#aiRow .modeChip').forEach(b=>b.classList.toggle('sel',b.dataset.ai===aiSel));
}
document.querySelectorAll('#aiRow .modeChip').forEach(b=>{
  b.addEventListener('click',()=>{b.blur();sfx.ensure();aiSel=b.dataset.ai;refreshAiChips();});
});
refreshAiChips();
duelBtn.addEventListener('click',()=>{duelBtn.blur();duelStart();});
tourBtn.addEventListener('click',()=>{tourBtn.blur();tourStart();});
lbBot.addEventListener('click',()=>{if(G.replay&&G.replay.active)endReplay();});

// performance mode: auto / high / battery
function refreshPerfBtn(){
  perfBtn.style.opacity=PERF.mode==='lo'?'0.45':(PERF.mode==='hi'?'1':'0.8');
}
perfBtn.addEventListener('click',()=>{
  perfBtn.blur();
  PERF.mode=PERF.mode==='auto'?'hi':PERF.mode==='hi'?'lo':'auto';
  store.set('cc_perf',PERF.mode);
  if(PERF.mode==='hi')applyPerfLevel(0);
  else if(PERF.mode==='lo')applyPerfLevel(2);
  else applyPerfLevel(store.get('cc_perf_lvl',0));
  refreshPerfBtn();
  toast(tr(PERF.mode==='auto'?'perf_auto':PERF.mode==='hi'?'perf_hi':'perf_lo'));
});
refreshPerfBtn();

// battle code: import / clear rival ghost
codeImportBtn.addEventListener('click',()=>{
  codeImportBtn.blur();
  const rival=store.get('cc_rival',null);
  codeHint.textContent=rival?tr('code_loaded')+'：'+(rival.t/10).toFixed(1)+'s':'';
  codeArea.value='';
  codeScreen.classList.remove('hidden');
});
codeCloseBtn.addEventListener('click',()=>{codeCloseBtn.blur();codeScreen.classList.add('hidden');});
codeLoadBtn.addEventListener('click',async()=>{
  try{
    await loadRivalCode(codeArea.value);
    codeHint.textContent=tr('code_loaded')+'：'+((JSON.parse(localStorage.getItem('cc_rival')).t)/10).toFixed(1)+'s';
    setTimeout(()=>codeScreen.classList.add('hidden'),900);
  }catch(e){
    toast(tr('code_invalid'));
  }
});
codeClearBtn.addEventListener('click',()=>{
  store.set('cc_rival',null);
  G.ghostData=store.get('cc_ghost',null);
  codeHint.textContent='';
  toast(tr('code_clear')+' ✓');
});
codeCopyBtn.addEventListener('click',async()=>{
  try{
    await navigator.clipboard.writeText(codeInput.value);
    toast(tr('copied'));
  }catch(e){
    codeInput.select();
    if(document.execCommand)document.execCommand('copy');
    toast(tr('copied'));
  }
});
codeInput.addEventListener('click',()=>codeInput.select());

boardBtn.addEventListener("click",()=>{boardBtn.blur();renderBoard();boardScreen.classList.remove("hidden");refreshWorld(false);});
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

/* ================================================================
   Share: mode-aware battle card (live scene + stats) and panel
================================================================ */
function shareUrl(){
  return location.origin+location.pathname;
}
function duelWinnerKey(){
  return DUEL.t1<DUEL.t2?'duel_p1win':(DUEL.t2<DUEL.t1?'duel_p2win':'duel_draw');
}
function aiOutcomeKey(){
  if(G.dnf)return AI.finishTime!=null?'opp_lose':'opp_dnf';
  if(AI.finishTime==null)return 'opp_win';
  return G.finishTime<=AI.finishTime?'opp_win':'opp_lose';
}
function shareText(){
  const rank=I18N[lang].ranks[rankIndex()];
  const zh=lang==='zh';
  let mode;
  if(TOUR.on){
    mode=zh?'錦標賽 '+TOUR.marks+' · '+tr('pts')+' '+TOUR.pts+'/9'
          :'Championship '+TOUR.marks+' · '+TOUR.pts+'/9 pts';
  }else if(DUEL.on){
    mode=zh?`1P ${DUEL.t1.toFixed(1)}s vs 2P ${DUEL.t2.toFixed(1)}s（${tr(duelWinnerKey())}）`
          :`1P ${DUEL.t1.toFixed(1)}s vs 2P ${DUEL.t2.toFixed(1)}s (${tr(duelWinnerKey())})`;
  }else if(AI.level){
    const at=AI.finishTime!=null?AI.finishTime.toFixed(1)+'s':'DNF';
    mode=zh?`vs ${tr('ai_'+AI.level)}（${at}）${tr(aiOutcomeKey())}`
          :`vs ${tr('ai_'+AI.level)} (${at}) — ${tr(aiOutcomeKey())}`;
  }else if(G.practice){
    mode=zh?'練習模式':'practice';
  }else{
    mode=zh?`獨跑 · ${rank}`:`solo · ${rank}`;
  }
  const main=zh
    ? `達達馬蹄 Clip-Clop｜${G.dnf&&!DUEL.on?'時間到':G.finishTime.toFixed(1)+'s'} · 跌倒 ${G.falls} 次`
    : `Clip-Clop｜${G.dnf&&!DUEL.on?'time up':G.finishTime.toFixed(1)+'s'} · ${G.falls} falls`;
  return `${main}｜${mode} 🐎\n${shareUrl()}`;
}

async function makeShareCard(){
  const W=1200,H=630;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const c=cv.getContext('2d');
  // background: the live scene, cover-cropped
  renderer.render(scene,camera);
  const src=renderer.domElement;
  const sc=Math.max(W/src.width,H/src.height);
  c.drawImage(src,(W-src.width*sc)/2,(H-src.height*sc)/2,src.width*sc,src.height*sc);
  let gr=c.createLinearGradient(0,0,0,H);
  gr.addColorStop(0,'rgba(18,12,6,.78)');
  gr.addColorStop(.42,'rgba(18,12,6,.18)');
  gr.addColorStop(1,'rgba(18,12,6,.82)');
  c.fillStyle=gr; c.fillRect(0,0,W,H);
  try{
    await Promise.all([
      document.fonts.load('900 60px "Noto Sans TC"'),
      document.fonts.load('800 60px "Baloo 2"'),
    ]);
  }catch(e){}
  c.strokeStyle='#f5a524'; c.lineWidth=8;
  c.strokeRect(22,22,W-44,H-44);
  c.textBaseline='top';
  // header
  c.fillStyle='#fff6e8';
  c.font='900 44px "Noto Sans TC","Baloo 2"';
  c.fillText(lang==='zh'?'達達馬蹄':'Clip-Clop',64,58);
  c.font='800 26px "Baloo 2","Noto Sans TC"';
  c.fillStyle='#f5a524';
  c.fillText('CLIP-CLOP HORSE · 50 m / 90 s',66,114);
  // rank badge (top-right)
  c.font='96px serif';
  c.textAlign='right';
  c.fillText(RANK_ICONS[rankIndex()],W-70,52);
  c.textAlign='left';
  // big time
  c.fillStyle='#f5d90a';
  c.font='900 170px "Baloo 2","Noto Sans TC"';
  c.fillText(G.dnf&&!DUEL.on?'DNF':G.finishTime.toFixed(1),64,208);
  c.font='800 54px "Baloo 2"';
  c.fillStyle='#fff6e8';
  const tw=c.measureText(G.dnf&&!DUEL.on?'DNF':G.finishTime.toFixed(1)).width+64+30;
  c.fillText('s',tw,322);
  // mode line
  c.font='900 40px "Noto Sans TC","Baloo 2"';
  c.fillStyle='#fff';
  let mode;
  if(TOUR.on){
    mode='Championship '+TOUR.marks+' · '+TOUR.pts+'/9';
  }else if(DUEL.on){
    mode=`1P ${DUEL.t1.toFixed(1)}s vs 2P ${DUEL.t2.toFixed(1)}s — ${tr(duelWinnerKey())}`;
  }else if(AI.level){
    const at=AI.finishTime!=null?AI.finishTime.toFixed(1)+'s':'DNF';
    mode=`vs ${tr('ai_'+AI.level)} ${at}s · ${tr(aiOutcomeKey())}`;
  }else if(G.practice){
    mode=tr('practice');
  }else{
    mode=I18N[lang].ranks[rankIndex()];
  }
  c.fillText(mode,64,412);
  // stats + url
  c.font='800 30px "Noto Sans TC","Baloo 2"';
  c.fillStyle='#e8dcc8';
  c.fillText(`${tr('st_falls').replace(/[（）(].*$/,'')} ${G.falls}　·　${tr('st_steps').replace(/[（）(].*$/,'')} ${G.steps}　·　${tr('st_speed')} ${(G.topSpeed*3.6).toFixed(1)} km/h`,64,480);
  c.fillStyle='#f5a524';
  c.font='700 26px "Baloo 2","Noto Sans TC"';
  c.fillText(shareUrl().replace(/^https?:\/\//,''),64,546);
  return cv.toDataURL('image/png');
}

let shareCardUrl='';
shareBtn.addEventListener('click',async()=>{
  shareCardUrl=await makeShareCard();
  shareImg.src=shareCardUrl;
  const txt=shareText();
  shareX.href='https://twitter.com/intent/tweet?text='+encodeURIComponent(txt);
  shareLine.href='https://social-plugins.line.me/lineit/share?url='+encodeURIComponent(shareUrl())+'&text='+encodeURIComponent(txt.split('\n')[0]);
  shareScreen.classList.remove('hidden');
});
shareClose.addEventListener('click',()=>{shareClose.blur();shareScreen.classList.add('hidden');});
shareCopy.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(shareText());toast(tr('copied'));}catch(e){}
});
shareDl.addEventListener('click',()=>{
  const a=document.createElement('a');
  a.href=shareCardUrl;
  a.download='clip-clop-'+(DUEL.on?'duel':G.dnf?'dnf':G.finishTime.toFixed(1)+'s')+'.png';
  a.click();
});
shareNative.addEventListener('click',async()=>{
  const text=shareText();
  try{
    const blob=await (await fetch(shareCardUrl)).blob();
    const file=new File([blob],'clip-clop.png',{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({text,files:[file]});
      return;
    }
    if(navigator.share){await navigator.share({text});return;}
  }catch(e){}
  try{await navigator.clipboard.writeText(text);toast(tr('copied'));}catch(_){}
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
  const celebrate=G.state==='done'&&!G.dnf&&!G.replay;

  // finish replay: the player's horse is posed from the recorded stream
  let repF=null;
  if(G.replay&&G.replay.active){
    const frames=G.replay.frames;
    repF=frames[Math.min(frames.length-1,Math.floor(G.replay.t*30))];
  }

  // body pose: live sim state, or the tumble pose while fallen
  const p=repF?null:G.fallPose;
  let by=G.y, bro=G.roll, byaw=G.yaw||0, bp=G.pitch, bz=G.z||0;
  if(repF){
    by=repF[1]; bro=repF[2]; bp=repF[3]; byaw=repF[4]; bz=repF[5];
    horseRoot.position.set(repF[0],by-CFG.bodyY,bz);
  }else if(p&&p.rise>0){
    const s=p.rise*p.rise*(3-2*p.rise), f=p.from, L=(a,b)=>a+(b-a)*s;
    by=L(f.y,CFG.bodyY); bro=L(f.roll,0); byaw=L(f.yaw,0); bp=L(f.pitch,0); bz=L(f.z,0);
    horseRoot.position.set(G.x,by-CFG.bodyY,bz);
  }else if(p){
    by=p.y; bro=p.roll; byaw=p.yaw; bp=p.pitch; bz=p.z;
    horseRoot.position.set(G.x,by-CFG.bodyY,bz);
  }else{
    horseRoot.position.set(G.x,by-CFG.bodyY,bz);
  }
  tilt.rotation.set(bro,byaw,bp);
  if(celebrate)horseRoot.position.y+=Math.abs(Math.sin(animT*7))*0.12;

  // legs: true IK sync (visual reach == physics reach); pressed keys light the band
  for(let i=0;i<4;i++){
    const leg=legs[i];
    const src=repF?{th:repF[6+i],lift:repF[10+i]}:(p?p.legs[i]:leg);
    applyLegVisual(leg,src.th,src.lift);
    const pressed=!!held[leg.cfg.key]&&G.state!=='done';
    leg.band.material.emissive.setHex(pressed?leg.cfg.color:0x000000);
    leg.band.material.emissiveIntensity=pressed?0.55:0;
  }

  // AI opponent horse (far lane), same pose rules
  if(aiRoot.visible&&AI.S&&aiParts){
    const ap=AI.S.fallPose;
    let aby=AI.S.y, abro=AI.S.roll, abyaw=AI.S.yaw, abp=AI.S.pitch, abz=AI.S.z;
    if(ap&&ap.rise>0){
      const s=ap.rise*ap.rise*(3-2*ap.rise), f=ap.from, L=(a,b)=>a+(b-a)*s;
      aby=L(f.y,CFG.bodyY); abro=L(f.roll,0); abyaw=L(f.yaw,0); abp=L(f.pitch,0); abz=L(f.z,0);
    }else if(ap){
      aby=ap.y; abro=ap.roll; abyaw=ap.yaw; abp=ap.pitch; abz=ap.z;
    }
    aiRoot.position.set(AI.S.x,aby-CFG.bodyY,abz+AI_LANES[AI.level]);
    aiTilt.rotation.set(abro,abyaw,abp);
    for(let i=0;i<4;i++){
      const src=ap?ap.legs[i]:AI.L[i];
      applyLegVisual(aiParts.legs[i],src.th,src.lift);
    }
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

  // ghost: replay the best run's recorded pose stream (hidden while an AI races)
  const gOn=G.ghostOn&&!AI.level&&G.ghostData&&G.state!=='title'&&ghostParts;
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
  if(G.replay&&G.replay.active&&repF){
    // finish replay: low side dolly tracking the recorded horse
    px=repF[0]-2.4; py=1.15; pz=6.6;
    lx=repF[0]+0.9; ly=1.0; lz=0;
  }else if(G.state==='title'){
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
  const aiOn=!!AI.level&&G.state!=='title';
  aiPill.classList.toggle('hidden',!aiOn);
  if(aiOn&&AI.S){
    hudAi.textContent=AI.finishTime!=null
      ? AI.finishTime.toFixed(1)+'s ✓'
      : Math.max(0,CFG.finishX-AI.S.x).toFixed(1)+' m';
  }
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
      buzz(40);
    }
  }else{
    // fixed-step simulation at 240 Hz, like the original
    if((G.state==='run'||G.state==='fallen')&&G.countdown<=0&&AI.level)aiDrive(dt);
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
        simStep(CFG.STEP);       // routes to the tumble sim automatically once fallen
        aiTick(CFG.STEP);
      }else break;
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
  perfTick(dt);
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
buildAIHorse();
buildDust();
buildHoofprints();
buildConfetti();
buildCrowd();
perfInit();
{
  const rv=store.get('cc_rival',null);
  G.ghostData=rv?{t:rv.t/10,pose:rv.pose}:store.get('cc_ghost',null);
}
if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
window.__ready=true;
window.__game=G;       // debug/testing hook
window.__legs=legs;
window.__CFG=CFG;
window.__AI=AI;
window.__DUEL=DUEL;
window.__TOUR=TOUR;
window.__tick=tick;    // manual frame pump for automated tests (rAF may be throttled in embedded browsers)
window.__errs=[];
addEventListener('error',e=>window.__errs.push(e.message+' @'+(e.filename||'')+':'+e.lineno));
addEventListener('unhandledrejection',e=>window.__errs.push('rejection: '+e.reason));
loadingEl.remove();
loop();
